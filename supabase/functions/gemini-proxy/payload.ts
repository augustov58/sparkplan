/**
 * What the gemini-proxy Edge Function sends to Gemini and reads back. Pure (no
 * Deno, no fetch) so tests/geminiProxyPayload343.test.ts can check the shape.
 *
 * Gemini 3 (#343): one model, chosen here (callers no longer pick it); no
 * temperature / topP / topK; `thinkingLevel` instead of `thinkingBudget`; a
 * tool result goes back as role 'user' (role 'function' is a 400), after the
 * model's own function-call part replayed unchanged, thought signature included.
 */

export const GEMINI_MODEL = 'gemini-3.8-flash'

/** Gemini 3's documented stand-in when the original signature isn't available. */
const SKIP_SIGNATURE = 'skip_thought_signature_validator'

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export interface GeminiRequest {
  prompt: string
  systemInstruction?: string
  pdfData?: string // Base64 encoded PDF
  imageData?: string // Base64 encoded image
  imageMimeType?: string // e.g. image/jpeg, image/png, image/webp
  tools?: ToolDefinition[] // Function calling tools
  toolResult?: { // Result from a tool call to continue conversation
    toolName: string
    result: any
    /** The function-call part the proxy returned as `modelPart` (it carries the thought signature). */
    modelPart?: Record<string, any>
  }
  // Optional generationConfig overrides. When omitted: maxOutputTokens 8192, free-text response.
  responseMimeType?: string // e.g. "application/json" to force structured output
  responseSchema?: Record<string, any> // OpenAPI-style schema; used with responseMimeType=application/json
  maxOutputTokens?: number
  thinkingLevel?: 'low' | 'medium' | 'high' // gemini-3.8-flash: default medium; 'minimal' is an error
}

export function geminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
}

export function buildGeminiPayload(request: GeminiRequest): Record<string, any> {
  const { prompt, systemInstruction, pdfData, imageData, imageMimeType, tools, toolResult } = request

  let contents: any[]
  if (toolResult) {
    // Continuation after a tool call: the question, the model's call, the tool's answer
    const callPart = toolResult.modelPart ?? {
      functionCall: { name: toolResult.toolName, args: {} },
      thoughtSignature: SKIP_SIGNATURE, // a client from before #343 doesn't send the part back
    }
    const callId = callPart.functionCall?.id
    contents = [
      { role: 'user', parts: [{ text: prompt }] },
      { role: 'model', parts: [callPart] },
      {
        role: 'user',
        parts: [{
          functionResponse: {
            name: toolResult.toolName,
            response: toolResult.result,
            ...(callId && { id: callId }),
          },
        }],
      },
    ]
  } else {
    const inputParts: any[] = [{ text: prompt }]
    if (pdfData) {
      inputParts.push({ inline_data: { mime_type: 'application/pdf', data: pdfData } })
    }
    if (imageData) {
      inputParts.push({ inline_data: { mime_type: imageMimeType || 'image/jpeg', data: imageData } })
    }
    contents = [{ role: 'user', parts: inputParts }]
  }

  const generationConfig: Record<string, any> = {
    maxOutputTokens: typeof request.maxOutputTokens === 'number' ? request.maxOutputTokens : 8192,
  }
  if (request.responseMimeType) {
    generationConfig.responseMimeType = request.responseMimeType
    if (request.responseSchema) {
      generationConfig.responseSchema = request.responseSchema
    }
  }
  if (request.thinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel: request.thinkingLevel }
  }

  const payload: Record<string, any> = {
    contents,
    ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
    generationConfig,
  }

  if (tools && tools.length > 0) {
    payload.tools = [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    }]
    payload.toolConfig = { functionCallingConfig: { mode: 'AUTO' } } // Let Gemini decide when to call tools
  }

  return payload
}

/**
 * The proxy's answer: a function call (with the part to send back on the
 * continuation), or the text of every non-thought text part.
 */
export function readGeminiResponse(data: any):
  | { functionCall: { name: string; args: Record<string, any> }; modelPart: Record<string, any> }
  | { response: string } {
  const parts: any[] = data?.candidates?.[0]?.content?.parts || []
  const callPart = parts.find(part => part.functionCall)
  if (callPart) {
    return {
      functionCall: { name: callPart.functionCall.name, args: callPart.functionCall.args || {} },
      modelPart: callPart,
    }
  }
  const text = parts.filter(part => part.text && !part.thought).map(part => part.text).join('')
  return { response: text || 'No response generated' }
}
