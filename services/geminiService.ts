/**
 * Gemini AI Service - Secure Edge Function Proxy
 * All AI requests are routed through Supabase Edge Functions
 * to prevent API key exposure in frontend code
 */

import { supabase } from '@/lib/supabase';
import { LoadItem, Project, GroundingDetail } from "../types";

const NEC_SYSTEM_INSTRUCTION = `
You are a Senior Electrical Engineer and Master Electrician specializing in the National Electrical Code (NEC).
Your goal is to assist users in designing safe, compliant electrical systems.
Always reference specific NEC articles (using the 2023 edition unless specified otherwise).
Be concise, technical, and professional.
`;

/**
 * Call Gemini AI via Supabase Edge Function
 * Ensures API key is not exposed in frontend
 */
async function callGeminiProxy(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return "Authentication required. Please log in.";
    }

    const response = await supabase.functions.invoke('gemini-proxy', {
      body: {
        prompt,
        systemInstruction: systemInstruction || NEC_SYSTEM_INSTRUCTION,
        model: 'gemini-2.0-flash-exp'
      }
    });

    if (response.error) {
      console.error('Gemini proxy error:', response.error);
      return "AI service temporarily unavailable. Please try again.";
    }

    return response.data?.response || "No response generated.";
  } catch (error) {
    console.error("Error calling Gemini proxy:", error);
    return "Unable to connect to AI service.";
  }
}

export const validateLoadCalculation = async (loads: LoadItem[], voltage: number, phase: number) => {
  const prompt = `
  Review the following electrical load calculation for a ${voltage}V ${phase}-phase system.
  Loads: ${JSON.stringify(loads)}

  1. Calculate total connected load (kVA).
  2. Apply standard NEC demand factors (Article 220) generally.
  3. Recommend a minimum service entrance conductor ampacity.
  4. Flag any potential code violations or unusual load configurations.

  Format the response as a clean, bulleted technical summary.
  `;

  return await callGeminiProxy(prompt);
};

export const generateOneLineDescription = async (project: Project) => {
  const prompt = `
  Generate a technical description for a One-Line Diagram for this project:
  Name: ${project.name}
  Type: ${project.type}
  Service: ${project.serviceVoltage}V, ${project.servicePhase}-Phase
  Total Circuits: ${project.circuits.length}

  Describe the hierarchy from Utility Service -> Meter -> Main Disconnect -> Main Distribution Panel -> Branch Circuits.
  Include grounding electrode system components required by NEC 250.
  `;

  return await callGeminiProxy(prompt);
};

export const validateGrounding = async (grounding: GroundingDetail, serviceAmps: number) => {
  const prompt = `
  Validate the following Grounding & Bonding plan against NEC Article 250.

  Service Size: ${serviceAmps} Amps
  Electrodes Selected: ${grounding.electrodes.join(', ')}
  GEC Size: ${grounding.gecSize}
  Bonding Targets: ${grounding.bonding.join(', ')}

  1. Is the GEC size compliant with Table 250.66?
  2. Are the selected electrodes sufficient (250.50, 250.52)?
  3. Are there missing bonding requirements (250.104)?

  Provide a Pass/Fail assessment and specific citations.
  `;

  return await callGeminiProxy(prompt);
};

export const generateInspectionChecklist = async (type: string, phase: string) => {
  const prompt = `
  Generate a concise list of 5 critical NEC pre-inspection checks for a ${type} project in the ${phase} phase.
  Return JSON format: [{"requirement": "description...", "category": "General"}].
  `;

  return await callGeminiProxy(prompt, NEC_SYSTEM_INSTRUCTION);
};

export const askNecAssistant = async (question: string, context?: string) => {
  const prompt = `
  User Question: ${question}
  ${context ? `Project Context: ${context}` : ''}

  Answer strictly based on the NEC. Cite the article number.
  `;

  return await callGeminiProxy(prompt);
};
