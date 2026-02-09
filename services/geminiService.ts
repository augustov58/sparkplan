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

MULTI-FAMILY DWELLING KNOWLEDGE:
- NEC 220.84 Optional Calculation applies to multi-family (3+ units) with individual cooking + heating/AC
- It replaces standard NEC 220 demand factors with a single blanket demand factor based on unit count
- Meter stacks (CT cabinets) are used for multi-family metering — each unit gets a meter position
- Panel hierarchy: Utility → Meter Stack (CT Cabinet) → MDP → Unit Panels + House Panel + EV Panel
- House panel serves common area loads (hallway lighting, exterior, fire alarm, elevator, etc.)
- NEC 220.57 per-EVSE load = max(7,200 VA, nameplate). NEC 625.42 allows EVEMS to reduce service sizing.
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
        model: 'gemini-2.5-flash'
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

export const generateInspectionChecklist = async (
  type: string,
  phase: string,
  projectContext?: string
) => {
  let prompt = '';

  if (projectContext) {
    // Project-specific checklist
    prompt = `
You are generating a pre-inspection checklist for a SPECIFIC electrical project.

${projectContext}

Based on the project data above, generate 8-10 project-specific NEC inspection items for the ${phase} phase.

IMPORTANT REQUIREMENTS:
1. Reference SPECIFIC equipment from the project (e.g., "Panel H1", "Circuit C-12", "Transformer XFMR-1", "Feeder F1")
2. Include actual ratings and specifications (e.g., "225A panel", "#6 Cu conductor", "75kVA transformer")
3. Focus on items that inspectors will actually check on THIS project
4. Reference specific NEC articles applicable to the equipment
5. Cover these categories: Panels, Circuits, Feeders, Transformers, Grounding, Clearances, Protection

Examples of GOOD project-specific items:
- "Verify Panel H1 (225A) has 36-inch clearance per NEC 110.26(A)(2)"
- "Check Circuit C-14 (50A EV charging) uses #6 Cu minimum per NEC 625.41"
- "Confirm Feeder F1 (#2 Cu) voltage drop is under 3% per NEC 215.2(A)(3) FPN #2"
- "Inspect Transformer XFMR-1 (75kVA) disconnect per NEC 450.14"

Return ONLY valid JSON (no markdown, no code blocks):
[{"requirement": "description with specific panel/circuit/feeder name and NEC article", "category": "category name"}]
    `;
  } else {
    // Generic fallback if no project context
    prompt = `
Generate a concise list of 5 critical NEC pre-inspection checks for a ${type} project in the ${phase} phase.
Return ONLY valid JSON (no markdown, no code blocks):
[{"requirement": "description...", "category": "General"}]
    `;
  }

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

// ============================================================================
// ENHANCED CHATBOT WITH CONVERSATION MEMORY (Phase 2.5)
// ============================================================================

/**
 * Ask NEC Assistant with conversation memory support
 *
 * This enhanced version maintains conversation context across multiple turns,
 * allowing for natural follow-up questions and context-aware responses.
 *
 * @param question - The user's current question
 * @param conversationHistory - Formatted string of previous conversation
 * @param projectContext - Project context (panels, circuits, etc.)
 * @param isFirstMessage - Whether this is the first message in conversation
 * @returns AI response string
 */
export const askNecAssistantWithMemory = async (
  question: string,
  conversationHistory: string,
  projectContext?: string,
  isFirstMessage: boolean = true
): Promise<string> => {
  // Build system instruction with conversation awareness
  const systemInstruction = buildMemoryAwareSystemInstruction(projectContext, isFirstMessage);

  // Build the prompt with conversation history
  const prompt = buildMemoryAwarePrompt(question, conversationHistory, projectContext, isFirstMessage);

  return await callGeminiProxy(prompt, systemInstruction);
};

/**
 * Builds system instruction for memory-aware conversations
 */
function buildMemoryAwareSystemInstruction(
  projectContext?: string,
  isFirstMessage: boolean = true
): string {
  return `
You are a Senior Electrical Engineer and Master Electrician working as an AI copilot for NEC compliance.
You specialize in the National Electrical Code (NEC) and help design safe, compliant electrical systems.

CONVERSATION CAPABILITIES:
- You have memory of our conversation and can reference previous questions/answers
- Build on prior context instead of repeating information
- If the user references something discussed earlier, acknowledge and connect to it
- Track decisions, recommendations, and calculations made during our conversation
- Use phrases like "As we discussed..." or "Building on the earlier analysis..." when appropriate

${projectContext && isFirstMessage ? `
PROJECT CONTEXT AVAILABLE:
You have access to the user's current project data including panels, circuits, feeders, and transformers.
- Reference specific equipment by name when relevant (e.g., "Panel H1", "Circuit 14")
- Check if questions relate to their actual project configuration
- Provide specific recommendations based on their project data
` : ''}

${!isFirstMessage ? `
FOLLOW-UP CONTEXT:
This is a follow-up message in an ongoing conversation. The user may be:
- Asking for clarification on a previous answer
- Building on a previous recommendation
- Requesting additional calculations or analysis
- Changing parameters from an earlier scenario
` : ''}

MULTI-FAMILY DWELLING KNOWLEDGE:
- NEC 220.84 Optional Calculation applies to multi-family buildings (3+ dwelling units)
- It replaces standard NEC 220 demand factors with a single blanket demand factor based on unit count
- Panel hierarchy: Utility → Meter Stack (CT Cabinet) → MDP → Unit Panels + House Panel + EV Panel
- House panel serves common area loads (hallway lighting, exterior, fire alarm, elevator, etc.)
- NEC 220.57 per-EVSE load = max(7,200 VA, nameplate). NEC 625.42 allows EVEMS to reduce service sizing.

RESPONSE GUIDELINES:
- Always reference specific NEC articles (2023 edition unless specified)
- Be concise, technical, and professional
- When appropriate, suggest related considerations they might not have asked about
- If you need clarification about something discussed earlier, ask
  `.trim();
}

/**
 * Builds the prompt with conversation history and context
 */
function buildMemoryAwarePrompt(
  question: string,
  conversationHistory: string,
  projectContext?: string,
  isFirstMessage: boolean = true
): string {
  let prompt = '';

  // Include full project context on first message
  if (isFirstMessage && projectContext) {
    prompt += `${projectContext}\n\n`;
  }

  // Include conversation history for follow-up messages
  if (conversationHistory && !isFirstMessage) {
    prompt += `PREVIOUS CONVERSATION:\n${conversationHistory}\n\n`;
  }

  // Add the current question
  prompt += `CURRENT QUESTION: ${question}`;

  // Add contextual instructions
  if (!isFirstMessage) {
    prompt += `

FOLLOW-UP INSTRUCTIONS:
- Reference previous messages when relevant
- Build on prior context instead of repeating
- If the user references something from earlier, acknowledge it
- Keep track of any decisions or recommendations made`;
  } else if (projectContext) {
    prompt += `

INSTRUCTIONS:
- If the question references specific equipment, look it up in the project context
- Provide specific answers based on their actual project configuration
- Cite relevant NEC articles
- Mention if something applies specifically to their project`;
  }

  return prompt;
}

// ============================================================================
// AGENTIC ACTIONS - FUNCTION CALLING (Phase 2.5.2)
// ============================================================================

import { getToolDefinitionsForGemini, executeTool, type ToolContext } from './ai/chatTools';
import { buildProjectContext, formatContextForAI, type ProjectContext } from './ai/projectContextBuilder';

interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

interface GeminiWithToolsResponse {
  response?: string;
  functionCall?: FunctionCall;
}

/**
 * Call Gemini API with function calling support
 */
async function callGeminiProxyWithTools(
  prompt: string,
  systemInstruction: string,
  tools: ReturnType<typeof getToolDefinitionsForGemini>
): Promise<GeminiWithToolsResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { response: "Authentication required. Please log in." };
    }

    const response = await supabase.functions.invoke('gemini-proxy', {
      body: {
        prompt,
        systemInstruction,
        model: 'gemini-2.5-flash',
        tools,
      }
    });

    if (response.error) {
      console.error('Gemini proxy error:', response.error);
      return { response: `AI service error: ${response.error.message}` };
    }

    // Check if response contains a function call
    if (response.data?.functionCall) {
      return { functionCall: response.data.functionCall };
    }

    return { response: response.data?.response || "No response generated." };
  } catch (error) {
    console.error("Error calling Gemini proxy with tools:", error);
    return { response: "Unable to connect to AI service." };
  }
}

/**
 * Call Gemini API with tool result to continue the conversation
 */
async function callGeminiProxyWithToolResult(
  originalPrompt: string,
  systemInstruction: string,
  toolName: string,
  toolResult: unknown
): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return "Authentication required. Please log in.";
    }

    const response = await supabase.functions.invoke('gemini-proxy', {
      body: {
        prompt: originalPrompt,
        systemInstruction,
        model: 'gemini-2.5-flash',
        toolResult: {
          toolName,
          result: toolResult,
        },
      }
    });

    if (response.error) {
      console.error('Gemini proxy error:', response.error);
      return `AI service error: ${response.error.message}`;
    }

    return response.data?.response || "No response generated.";
  } catch (error) {
    console.error("Error calling Gemini proxy with tool result:", error);
    return "Unable to connect to AI service.";
  }
}

/**
 * Ask NEC Assistant with agentic tool support
 *
 * This function enables the AI to execute calculations and actions
 * by calling tools defined in chatTools.ts.
 *
 * @param question - The user's question
 * @param conversationHistory - Formatted conversation history
 * @param projectContext - Project context object (not string)
 * @param isFirstMessage - Whether this is the first message
 * @returns AI response string (after executing any necessary tools)
 */
export const askNecAssistantWithTools = async (
  question: string,
  conversationHistory: string,
  projectContext: ProjectContext,
  isFirstMessage: boolean = true
): Promise<{ response: string; toolUsed?: { name: string; result: unknown } }> => {
  // Build tool context
  const toolContext: ToolContext = {
    projectId: projectContext.projectId,
    projectContext,
  };

  // Build system instruction with tool awareness
  const systemInstruction = buildAgenticSystemInstruction(projectContext, isFirstMessage);

  // Build the prompt
  const prompt = buildMemoryAwarePrompt(
    question,
    conversationHistory,
    isFirstMessage ? formatContextForAI(projectContext) : undefined,
    isFirstMessage
  );

  // Get tool definitions
  const tools = getToolDefinitionsForGemini();

  // First call - may return function call or direct response
  const initialResponse = await callGeminiProxyWithTools(prompt, systemInstruction, tools);

  // If Gemini wants to call a tool
  if (initialResponse.functionCall) {
    const { name, args } = initialResponse.functionCall;

    console.log('[askNecAssistantWithTools] Tool call requested:', name);
    console.log('[askNecAssistantWithTools] Tool args:', JSON.stringify(args, null, 2));

    // Execute the tool
    const toolResult = await executeTool(name, args, toolContext);

    console.log('[askNecAssistantWithTools] Tool result success:', toolResult.success);
    if (!toolResult.success) {
      console.log('[askNecAssistantWithTools] Tool error:', toolResult.error);
    }

    // Send tool result back to Gemini for natural language response
    const finalResponse = await callGeminiProxyWithToolResult(
      question,
      systemInstruction,
      name,
      toolResult.data || { error: toolResult.error }
    );

    return {
      response: finalResponse,
      toolUsed: { name, result: toolResult },
    };
  }

  // Direct response (no tool needed)
  return { response: initialResponse.response || "No response generated." };
};

/**
 * Builds system instruction for agentic conversations
 */
function buildAgenticSystemInstruction(
  projectContext: ProjectContext,
  isFirstMessage: boolean
): string {
  return `
You are a Senior Electrical Engineer and NEC compliance AI copilot with access to calculation tools.
You can execute real calculations and checks on the user's project data.

AVAILABLE TOOLS:

**Read/Check Tools:**
- calculate_feeder_voltage_drop: Get voltage drop info for feeders
- check_panel_capacity: Check if panel can handle additional load
- check_conductor_sizing: Verify conductor sizing per Table 310.16
- check_service_upgrade: Analyze service upgrade needs
- run_quick_inspection: Run NEC compliance check on the project
- get_project_summary: Get overview of the project

**AI Agent Tools (Python Backend):**
- analyze_change_impact: Analyze impact of adding new loads (EV chargers, HVAC, etc.)
- draft_rfi: Draft professional RFI with NEC references
- predict_inspection: Predict inspection failures and get preparation checklist

**Action Tools (Modify Data):**
- add_circuit: Create a new circuit in a panel
- add_panel: Create a sub-panel fed from another panel OR transformer (voltage auto-set from source)
- fill_panel_with_test_loads: Bulk add test circuits to a panel (lighting, receptacles, HVAC, mixed) - respects slot limits
- empty_panel: Remove circuits from a panel (preserves feeder breakers for sub-panels by default)
- fill_with_spares: Fill remaining empty slots with SPARE circuits (no load, placeholder breakers)

WHEN TO USE TOOLS:
- User asks about feeder voltage drop → calculate_feeder_voltage_drop
- User asks "what if I add..." → analyze_change_impact
- User wants to create an RFI → draft_rfi
- User asks about inspection prep → predict_inspection
- User says "add a circuit for..." → add_circuit
- User says "create a panel..." or "add panel fed from transformer" → add_panel
- User says "fill panel with test loads" or "fill the MDP" → fill_panel_with_test_loads
  (Note: "MDP" refers to main panel. If user says "fill it" after discussing a panel, include that panel_name)
- User says "empty panel X", "clear panel X", "delete all circuits from X" → empty_panel
- User says "fill with spares", "add spare circuits", "fill remaining with spares" → fill_with_spares
- User wants project overview → get_project_summary

IMPORTANT FOR ACTION TOOLS:
- When calling action tools, ALWAYS include all required parameters
- For fill_panel_with_test_loads: if user mentioned a panel earlier (like "MDP"), include it as panel_name
- If user provides load_type or target_utilization in their follow-up message, include those too
- Panel slot limits: MDP/Main = 30 slots, Branch panels = 42 slots. Tools will respect these limits.

WHEN NOT TO USE TOOLS:
- General NEC questions (just answer directly)
- Explaining concepts or requirements
- User explicitly says "don't calculate" or "just explain"

PROJECT CONTEXT:
${formatContextForAI(projectContext)}

MULTI-FAMILY DWELLING KNOWLEDGE:
- NEC 220.84 Optional Calculation applies to multi-family buildings (3+ dwelling units)
- It replaces ALL standard NEC 220 demand factors with a single blanket demand factor based on unit count
- The demand factor decreases as unit count increases (e.g., 3 units → 45%, 12 units → 41%, 40+ units → 28%)
- Panel hierarchy for multi-family: Utility → Meter Stack (CT Cabinet) → MDP → Unit Panels + House Panel + EV Panel
- Meter stacks (CT cabinets) provide individual metering for each dwelling unit
- House panel serves common area loads (hallway lighting, exterior lighting, fire alarm, elevator, laundry, etc.)
- NEC 220.57: Per-EVSE load = max(7,200 VA, nameplate rating). This is NOT a demand factor.
- NEC 625.42: EVEMS (EV Energy Management System) allows sizing service to setpoint, not full connected load
- EV panels in multi-family are dedicated panels for shared/assigned EV charging stations

RESPONSE GUIDELINES:
- After using a tool, explain the results in plain language
- Always cite relevant NEC articles
- Be concise but thorough
- If a tool result shows an issue, explain the implications and recommendations
  `.trim();
}
