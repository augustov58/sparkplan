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
      
      // Provide more helpful error messages
      const errorMessage = response.error.message || response.error.toString();
      
      if (errorMessage.includes('free tier not enabled') || errorMessage.includes('limit: 0')) {
        return "⚠️ Gemini API free tier not enabled.\n\nPlease:\n1. Go to https://aistudio.google.com/app/apikey\n2. Check your API key status\n3. Enable free tier access or set up billing\n\nSee /docs/GEMINI_API_SETUP.md for details.";
      }
      
      if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
        return "⏱️ Rate limit exceeded. Please wait a minute and try again.\n\nFree tier: 15 requests/minute, 1,500 requests/day.";
      }
      
      if (errorMessage.includes('Invalid') || errorMessage.includes('401')) {
        return "🔑 Invalid API key. Please check your GEMINI_API_KEY in Supabase Edge Functions secrets.";
      }
      
      return `AI service error: ${errorMessage}\n\nPlease check /docs/GEMINI_API_SETUP.md for troubleshooting.`;
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
  const enhancedSystemInstruction = `
You are a Senior Electrical Engineer and Master Electrician specializing in the National Electrical Code (NEC).
Your goal is to assist users in designing safe, compliant electrical systems.

${context ? `
IMPORTANT: You have access to the user's current project data. When answering questions:
1. Reference specific panels, circuits, or feeders from the project when relevant
2. Check if the question relates to their actual project configuration
3. Provide specific recommendations based on their project data
4. If they ask about a panel/circuit/feeder, look it up in the project context
5. If their question is general NEC knowledge, answer generally but mention if it applies to their project
` : ''}

Always reference specific NEC articles (using the 2023 edition unless specified otherwise).
Be concise, technical, and professional.
  `;

  const prompt = `
User Question: ${question}
${context ? context : ''}

${context ? `
INSTRUCTIONS:
- If the question references a specific panel, circuit, or component, check the project context above
- Provide specific answers based on their actual project configuration
- Cite relevant NEC articles
- If the question is about something not in their project, answer generally but note it's not in their current design
` : `
Answer strictly based on the NEC. Cite the article number.
`}
  `;

  return await callGeminiProxy(prompt, enhancedSystemInstruction);
};
