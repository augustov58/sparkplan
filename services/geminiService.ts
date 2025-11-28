import { GoogleGenAI } from "@google/genai";
import { LoadItem, Project, GroundingDetail } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const NEC_SYSTEM_INSTRUCTION = `
You are a Senior Electrical Engineer and Master Electrician specializing in the National Electrical Code (NEC).
Your goal is to assist users in designing safe, compliant electrical systems.
Always reference specific NEC articles (using the 2023 edition unless specified otherwise).
Be concise, technical, and professional.
`;

export const validateLoadCalculation = async (loads: LoadItem[], voltage: number, phase: number) => {
  if (!apiKey) return "API Key missing.";

  try {
    const prompt = `
    Review the following electrical load calculation for a ${voltage}V ${phase}-phase system.
    Loads: ${JSON.stringify(loads)}

    1. Calculate total connected load (kVA).
    2. Apply standard NEC demand factors (Article 220) generally.
    3. Recommend a minimum service entrance conductor ampacity.
    4. Flag any potential code violations or unusual load configurations.

    Format the response as a clean, bulleted technical summary.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: NEC_SYSTEM_INSTRUCTION,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unable to validate loads at this time.";
  }
};

export const generateOneLineDescription = async (project: Project) => {
  if (!apiKey) return "API Key missing.";

  try {
    const prompt = `
    Generate a technical description for a One-Line Diagram for this project:
    Name: ${project.name}
    Type: ${project.type}
    Service: ${project.serviceVoltage}V, ${project.servicePhase}-Phase
    Total Circuits: ${project.circuits.length}

    Describe the hierarchy from Utility Service -> Meter -> Main Disconnect -> Main Distribution Panel -> Branch Circuits.
    Include grounding electrode system components required by NEC 250.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: NEC_SYSTEM_INSTRUCTION,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unable to generate diagram description.";
  }
};

export const validateGrounding = async (grounding: GroundingDetail, serviceAmps: number) => {
  if (!apiKey) return "API Key missing.";

  try {
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: NEC_SYSTEM_INSTRUCTION,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unable to validate grounding.";
  }
};

export const generateInspectionChecklist = async (type: string, phase: string) => {
  if (!apiKey) return "API Key missing.";
  
  try {
    const prompt = `
    Generate a concise list of 5 critical NEC pre-inspection checks for a ${type} project in the ${phase} phase.
    Return JSON format: [{"requirement": "description...", "category": "General"}].
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: NEC_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json"
      }
    });
    return response.text;
  } catch (error) {
    return "[]";
  }
};

export const askNecAssistant = async (question: string, context?: string) => {
  if (!apiKey) return "API Key missing.";

  try {
    const prompt = `
    User Question: ${question}
    ${context ? `Project Context: ${context}` : ''}

    Answer strictly based on the NEC. Cite the article number.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: NEC_SYSTEM_INSTRUCTION,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error consulting NEC Assistant.";
  }
};
