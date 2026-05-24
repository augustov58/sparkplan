/**
 * Panel Photo OCR Service
 *
 * Uses Gemini Vision AI to extract circuit information from panel photos.
 * Calls the gemini-proxy Edge Function for secure API access.
 */

import { supabase } from '@/lib/supabase';

/**
 * Circuit data extracted from panel photo
 */
export interface ExtractedCircuit {
  circuit_number: number;
  description: string | null;
  breaker_amps: number | null;
  load_watts: number | null;
  load_type: string | null;  // L, M, R, O, H, C, W, D, K
  pole: number;              // 1, 2, or 3
  conductor_size: string | null;
}

/**
 * Result from OCR extraction
 */
export interface ExtractionResult {
  circuits: ExtractedCircuit[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  error?: string;
}

/**
 * Standard breaker sizes per NEC
 */
const STANDARD_BREAKER_SIZES = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];

/**
 * Valid load type codes
 */
const VALID_LOAD_TYPES = ['L', 'M', 'R', 'O', 'H', 'C', 'W', 'D', 'K'];

/**
 * OpenAPI-style schema passed to Gemini's structured-output mode so the model
 * emits a JSON object with this exact shape (no markdown, no preamble).
 * Mirrors ExtractionResult + ExtractedCircuit.
 */
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    circuits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          circuit_number: { type: 'integer' },
          description: { type: 'string', nullable: true },
          breaker_amps: { type: 'integer', nullable: true },
          load_watts: { type: 'number', nullable: true },
          load_type: { type: 'string', nullable: true },
          pole: { type: 'integer' },
          conductor_size: { type: 'string', nullable: true },
        },
        required: ['circuit_number', 'pole'],
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['circuits', 'confidence', 'warnings'],
} as const;

/**
 * Parse JSON from LLM response, handling markdown code blocks
 */
function parseJsonResponse(responseText: string): any {
  let jsonText = responseText;

  // Remove markdown code blocks if present
  const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1] || responseText;
  } else {
    // Try to find raw JSON object
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }

  return JSON.parse(jsonText);
}

/**
 * Validate and normalize extracted circuit data
 */
function validateCircuit(circuit: any, maxCircuits: number): ExtractedCircuit | null {
  // Circuit number is required and must be valid
  const circuitNum = Number(circuit.circuit_number);
  if (isNaN(circuitNum) || circuitNum < 1 || circuitNum > maxCircuits) {
    return null;
  }

  // Validate breaker amps if provided
  let breakerAmps = circuit.breaker_amps ? Number(circuit.breaker_amps) : null;
  if (breakerAmps !== null && !STANDARD_BREAKER_SIZES.includes(breakerAmps)) {
    // Find closest standard size
    breakerAmps = STANDARD_BREAKER_SIZES.reduce((prev, curr) =>
      Math.abs(curr - breakerAmps!) < Math.abs(prev - breakerAmps!) ? curr : prev
    );
  }

  // Validate pole
  let pole = circuit.pole ? Number(circuit.pole) : 1;
  if (![1, 2, 3].includes(pole)) {
    pole = 1;
  }

  // Validate load type
  let loadType = circuit.load_type?.toUpperCase() || null;
  if (loadType && !VALID_LOAD_TYPES.includes(loadType)) {
    loadType = 'O'; // Default to "Other"
  }

  // Validate load watts if provided
  let loadWatts = circuit.load_watts ? Number(circuit.load_watts) : null;
  if (loadWatts !== null && (isNaN(loadWatts) || loadWatts < 0)) {
    loadWatts = null;
  }

  return {
    circuit_number: circuitNum,
    description: circuit.description?.trim() || null,
    breaker_amps: breakerAmps,
    load_watts: loadWatts,
    load_type: loadType,
    pole: pole,
    conductor_size: circuit.conductor_size?.trim() || null,
  };
}

/**
 * Build the prompt for Gemini Vision
 */
function buildExtractionPrompt(panelName: string, maxCircuits: number): string {
  return `Analyze this electrical panel photo and extract circuit information.
Panel: ${panelName}
Maximum Circuit Slots: ${maxCircuits}

Look for the panel schedule/directory card - the paper label listing circuit descriptions.
Extract information for each visible circuit.

For each circuit, extract:
- circuit_number: The slot number (1-${maxCircuits})
- description: The text label (e.g., "Kitchen Outlets", "Master Bedroom", "HVAC")
- breaker_amps: The breaker size (15, 20, 30, 40, 50, 60, 100, etc.)
- pole: Number of poles (1, 2, or 3) - estimate from breaker width if visible
- load_type: Classify as one of these codes:
  L = Lighting
  R = Receptacles/Outlets
  M = Motor
  H = Heating
  C = Cooling/AC/HVAC
  W = Water Heater
  D = Dryer
  K = Kitchen (range, oven, dishwasher)
  O = Other

Return a JSON object with this exact structure:
{
  "circuits": [
    {
      "circuit_number": 1,
      "description": "Kitchen Outlets",
      "breaker_amps": 20,
      "load_watts": null,
      "load_type": "K",
      "pole": 1,
      "conductor_size": null
    }
  ],
  "confidence": "high",
  "warnings": []
}

Rules:
- Only include circuits you can clearly read from the panel schedule
- Use null for any field you cannot determine from the photo
- Set confidence to "high" if text is clear, "medium" if partially readable, "low" if mostly guessing
- Add warnings for any issues (blurry text, missing labels, partial visibility)
- Do not make up circuit descriptions - only extract what you can read
- If the image shows no readable circuit information, return empty circuits array with a warning`;
}

/**
 * Extract circuit information from a panel photo using Gemini Vision
 *
 * @param imageBase64 - Base64 encoded image data (without data URL prefix)
 * @param panelName - Name of the panel for context
 * @param maxCircuits - Maximum number of circuits in the panel
 * @returns Extraction result with circuits, confidence, and warnings
 */
export async function extractCircuitsFromPhoto(
  imageBase64: string,
  panelName: string,
  maxCircuits: number,
  imageMimeType: string = 'image/jpeg'
): Promise<ExtractionResult> {
  try {
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        circuits: [],
        confidence: 'low',
        warnings: [],
        error: 'Authentication required. Please log in.',
      };
    }

    // Build prompt
    const prompt = buildExtractionPrompt(panelName, maxCircuits);

    // Call Gemini Vision via Edge Function.
    //
    // For image-based structured extraction we override the proxy's free-text
    // defaults so the model is constrained to emit valid JSON:
    //   - responseMimeType=application/json + responseSchema → no markdown fences,
    //     no narrative preamble, schema-validated structure.
    //   - temperature 0.1 → near-deterministic extraction (proxy default 0.7 is
    //     calibrated for chat, not OCR).
    //   - maxOutputTokens 16384 → 42-circuit panels with full descriptions can
    //     exceed the proxy's 8192 default once formatting is included.
    //   - thinkingBudget 0 → gemini-2.5-flash is a thinking model; disabling
    //     thinking for OCR (a perception task, not reasoning) frees the entire
    //     token budget for the actual JSON answer and prevents mid-object
    //     truncation.
    const response = await supabase.functions.invoke('gemini-proxy', {
      body: {
        prompt,
        imageData: imageBase64,
        imageMimeType,
        model: 'gemini-2.5-flash',
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 16384,
        thinkingBudget: 0,
      },
    });

    if (response.error) {
      // FunctionsHttpError wraps the real body; read it to surface the server's message
      let detail = response.error.message || 'Failed to analyze image';
      const ctx: any = (response.error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const body = await ctx.json();
          if (body?.error) detail = body.error;
        } catch { /* body not JSON, keep generic message */ }
      }
      console.error('Gemini proxy error:', detail);
      return {
        circuits: [],
        confidence: 'low',
        warnings: [],
        error: detail,
      };
    }

    const responseText = response.data?.response;
    if (!responseText) {
      return {
        circuits: [],
        confidence: 'low',
        warnings: ['No response from AI service'],
        error: 'No response received from AI',
      };
    }

    // Parse JSON response.
    //
    // With responseMimeType=application/json the response should already be
    // pure JSON, but parseJsonResponse() retains markdown/regex fallback as a
    // safety net for older proxy deployments and for graceful degradation if
    // the model emits a partial response (e.g. token cap hit).
    let parsed: any;
    try {
      parsed = parseJsonResponse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON. Raw response:', responseText);
      // Surface a preview of the raw response so the user can tell whether the
      // model returned prose, a truncated object, or an outright refusal.
      const preview = responseText.length > 200
        ? `${responseText.slice(0, 200)}…`
        : responseText;
      return {
        circuits: [],
        confidence: 'low',
        warnings: [`AI response was not valid JSON. Preview: ${preview}`],
        error: 'Failed to parse extraction results. The AI did not return valid JSON — see warnings for the raw response.',
      };
    }

    // Validate and normalize circuits
    const validCircuits: ExtractedCircuit[] = [];
    const seenNumbers = new Set<number>();

    if (Array.isArray(parsed.circuits)) {
      for (const circuit of parsed.circuits) {
        const validated = validateCircuit(circuit, maxCircuits);
        if (validated && !seenNumbers.has(validated.circuit_number)) {
          validCircuits.push(validated);
          seenNumbers.add(validated.circuit_number);
        }
      }
    }

    // Sort by circuit number
    validCircuits.sort((a, b) => a.circuit_number - b.circuit_number);

    // Normalize confidence
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low') {
      confidence = parsed.confidence;
    }

    // Collect warnings
    const warnings: string[] = Array.isArray(parsed.warnings) ? parsed.warnings : [];

    if (validCircuits.length === 0) {
      warnings.push('No readable circuit information found in image');
    }

    return {
      circuits: validCircuits,
      confidence,
      warnings,
    };
  } catch (error) {
    console.error('Error extracting circuits from photo:', error);
    return {
      circuits: [],
      confidence: 'low',
      warnings: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
