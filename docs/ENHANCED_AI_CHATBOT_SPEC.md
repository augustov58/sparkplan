# Enhanced AI Chatbot Technical Specification

**Version**: 1.0
**Created**: 2025-01-12
**Status**: Approved for Implementation
**Branch**: `feature/enhanced-ai-chatbot`

---

## Executive Summary

This specification outlines the enhancement of the NEC Pro Compliance AI chatbot from a stateless Q&A system to an intelligent, context-aware copilot with conversation memory, agentic actions, and RAG-powered NEC knowledge retrieval.

---

## Current State Analysis

### Existing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT CHATBOT FLOW                      │
├─────────────────────────────────────────────────────────────┤
│  User Question                                               │
│       ↓                                                      │
│  Project Context Builder (projectContextBuilder.ts)          │
│  └── Fetches: panels, circuits, feeders, transformers       │
│       ↓                                                      │
│  Static System Prompt (NEC_SYSTEM_INSTRUCTION)               │
│  └── "Reference NEC articles generally..."                   │
│       ↓                                                      │
│  Gemini 2.0 Flash (via Supabase Edge Function)              │
│       ↓                                                      │
│  Free-form text response                                     │
└─────────────────────────────────────────────────────────────┘
```

### Current Limitations

| Limitation | Impact | Solution |
|------------|--------|----------|
| No conversation memory | Users must repeat context | Phase 1 |
| Read-only responses | Can't execute calculations | Phase 2 |
| Static NEC knowledge | May cite outdated/incorrect info | Phase 4-5 |
| No streaming | Slow perceived response time | Phase 3 |

### Existing Files

- `services/geminiService.ts` - Gemini API proxy calls
- `services/ai/projectContextBuilder.ts` - Project context assembly
- `supabase/functions/gemini-proxy/index.ts` - Edge function proxy

---

## Phase 1: Conversation Memory

### Objective

Enable multi-turn conversations where the chatbot remembers previous exchanges within a session.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CONVERSATION MEMORY FLOW                    │
├─────────────────────────────────────────────────────────────┤
│  Chat Component State                                        │
│  └── messages: ChatMessage[]                                 │
│       ↓                                                      │
│  User sends new message                                      │
│       ↓                                                      │
│  Build conversation prompt                                   │
│  ├── System instruction                                      │
│  ├── Project context (first message only, or summarized)    │
│  ├── Conversation history (last N messages)                 │
│  └── Current user message                                   │
│       ↓                                                      │
│  Gemini API call                                            │
│       ↓                                                      │
│  Append response to messages[]                              │
│       ↓                                                      │
│  Optional: Persist to database for cross-session memory     │
└─────────────────────────────────────────────────────────────┘
```

### Data Structures

```typescript
// types/chat.ts

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    toolCalls?: ToolCall[];      // For Phase 2
    citations?: NECCitation[];   // For Phase 4
    projectContext?: boolean;    // Was project context included?
  };
}

export interface ChatSession {
  id: string;
  projectId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationContext {
  maxHistoryMessages: number;     // Default: 10
  includeProjectContext: boolean; // Default: true
  projectContextFrequency: 'first' | 'always' | 'summarized';
}
```

### Implementation Details

#### 1. Chat State Hook

```typescript
// hooks/useChat.ts

export function useChat(projectId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build conversation context
      const conversationHistory = buildConversationHistory(messages);

      // Call enhanced Gemini service
      const response = await askNecAssistantWithMemory(
        content,
        conversationHistory,
        projectContext
      );

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => setMessages([]);

  return { messages, sendMessage, isLoading, error, clearHistory };
}
```

#### 2. Conversation History Builder

```typescript
// services/ai/conversationBuilder.ts

const MAX_HISTORY_TOKENS = 4000; // Reserve tokens for history

export function buildConversationHistory(
  messages: ChatMessage[],
  maxMessages: number = 10
): string {
  // Take last N messages
  const recentMessages = messages.slice(-maxMessages);

  // Format for prompt
  return recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}

export function buildEnhancedPrompt(
  currentQuestion: string,
  conversationHistory: string,
  projectContext: string,
  isFirstMessage: boolean
): string {
  let prompt = '';

  // Include full project context on first message
  if (isFirstMessage && projectContext) {
    prompt += `${projectContext}\n\n`;
  }

  // Include conversation history
  if (conversationHistory) {
    prompt += `PREVIOUS CONVERSATION:\n${conversationHistory}\n\n`;
  }

  prompt += `CURRENT QUESTION: ${currentQuestion}`;

  return prompt;
}
```

#### 3. Enhanced Gemini Service

```typescript
// services/geminiService.ts (additions)

export const askNecAssistantWithMemory = async (
  question: string,
  conversationHistory: string,
  projectContext?: string
): Promise<string> => {
  const isFirstMessage = !conversationHistory;

  const enhancedSystemInstruction = `
You are a Senior Electrical Engineer and NEC specialist working as an AI copilot.
You have memory of our conversation and can reference previous questions/answers.

${projectContext && isFirstMessage ? `
PROJECT CONTEXT (provided at start of conversation):
${projectContext}
` : ''}

CONVERSATION GUIDELINES:
1. Reference previous messages when relevant ("As I mentioned earlier...")
2. Build on prior context instead of repeating
3. If user references something from earlier, acknowledge it
4. Keep track of any decisions or recommendations made

Always cite specific NEC articles (2023 edition unless specified).
Be concise, technical, and professional.
  `;

  const prompt = buildEnhancedPrompt(
    question,
    conversationHistory,
    projectContext || '',
    isFirstMessage
  );

  return await callGeminiProxy(prompt, enhancedSystemInstruction);
};
```

### UI Component

```typescript
// components/ChatPanel.tsx

export function ChatPanel({ projectId }: { projectId: string }) {
  const { messages, sendMessage, isLoading, clearHistory } = useChat(projectId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          NEC Assistant
        </h3>
        <button onClick={clearHistory} className="text-xs text-gray-500">
          Clear History
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about NEC compliance..."
            className="flex-1 px-3 py-2 border rounded-lg"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

### Database Schema (Optional - for persistence)

```sql
-- migrations/xxx_chat_sessions.sql

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast retrieval
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- RLS policies
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat sessions"
  ON chat_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage messages in their sessions"
  ON chat_messages FOR ALL
  USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );
```

---

## Phase 2: Agentic Actions

### Objective

Enable the chatbot to execute calculations, run inspections, and perform actions on the user's project.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENTIC ACTIONS FLOW                      │
├─────────────────────────────────────────────────────────────┤
│  User: "What's the voltage drop on Circuit 14?"             │
│       ↓                                                      │
│  Gemini analyzes intent → decides to call tool              │
│       ↓                                                      │
│  Function Call: calculate_voltage_drop({ circuit: "14" })   │
│       ↓                                                      │
│  Tool Executor                                               │
│  ├── Validate parameters                                    │
│  ├── Find circuit in project context                        │
│  ├── Call existing calculation service                      │
│  └── Format result                                          │
│       ↓                                                      │
│  Return tool result to Gemini                               │
│       ↓                                                      │
│  Gemini generates natural language response with results    │
│       ↓                                                      │
│  "Circuit 14 (EV Charger) has 2.8% voltage drop..."        │
└─────────────────────────────────────────────────────────────┘
```

### Tool Definitions

```typescript
// services/ai/chatTools.ts

import { z } from 'zod';

export interface ChatTool {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
  requiresConfirmation?: boolean; // For write operations
}

export interface ToolContext {
  projectId: string;
  projectContext: ProjectContext;
  userId: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  display?: {
    type: 'text' | 'table' | 'chart' | 'confirmation';
    content: any;
  };
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const CHAT_TOOLS: ChatTool[] = [
  // -------------------------------------------------------------------------
  // VOLTAGE DROP CALCULATOR
  // -------------------------------------------------------------------------
  {
    name: 'calculate_voltage_drop',
    description: `Calculate voltage drop for a circuit. Can specify by:
      - circuit_id: specific circuit UUID
      - circuit_number: circuit number in a panel (requires panel_name)
      - special values: "longest", "highest_load", "worst"`,
    parameters: z.object({
      circuit_id: z.string().optional(),
      circuit_number: z.number().optional(),
      panel_name: z.string().optional(),
      selector: z.enum(['longest', 'highest_load', 'worst']).optional(),
    }),
    execute: async (params, context) => {
      const circuit = findCircuit(params, context.projectContext);
      if (!circuit) {
        return { success: false, error: 'Circuit not found' };
      }

      const result = calculateVoltageDrop({
        conductorLength: circuit.length_ft || 100,
        loadAmps: circuit.load_watts / (circuit.voltage || 120),
        conductorSize: circuit.conductor_size,
        voltage: circuit.voltage || 120,
        conduitType: circuit.conduit_type || 'EMT',
        conductorMaterial: 'Cu',
        powerFactor: 0.9,
      });

      return {
        success: true,
        data: {
          circuitName: circuit.description,
          circuitNumber: circuit.circuit_number,
          panelName: circuit.panel_name,
          voltageDropPercent: result.voltageDropPercent,
          voltageDropVolts: result.voltageDropVolts,
          receivingEndVoltage: result.receivingEndVoltage,
          compliant: result.voltageDropPercent <= 3,
          recommendation: result.voltageDropPercent > 3
            ? `Increase conductor to ${result.recommendedSize} or reduce circuit length`
            : null,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // SHORT CIRCUIT CALCULATOR
  // -------------------------------------------------------------------------
  {
    name: 'calculate_short_circuit',
    description: 'Calculate available fault current at a panel for NEC 110.9 compliance',
    parameters: z.object({
      panel_id: z.string().optional(),
      panel_name: z.string().optional(),
    }),
    execute: async (params, context) => {
      const panel = findPanel(params, context.projectContext);
      if (!panel) {
        return { success: false, error: 'Panel not found' };
      }

      // Get upstream data (transformer, service)
      const result = await calculateShortCircuit(panel, context.projectContext);

      return {
        success: true,
        data: {
          panelName: panel.name,
          availableFaultCurrent: result.availableFaultCurrent,
          requiredAIC: result.requiredAIC,
          compliant: result.availableFaultCurrent <= result.requiredAIC,
          xrRatio: result.xrRatio,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // PANEL CAPACITY CHECK
  // -------------------------------------------------------------------------
  {
    name: 'check_panel_capacity',
    description: 'Check if a panel can accommodate additional load',
    parameters: z.object({
      panel_id: z.string().optional(),
      panel_name: z.string().optional(),
      additional_load_watts: z.number().optional(),
      additional_load_description: z.string().optional(),
    }),
    execute: async (params, context) => {
      const panel = findPanel(params, context.projectContext);
      if (!panel) {
        return { success: false, error: 'Panel not found' };
      }

      const currentLoad = calculatePanelLoad(panel, context.projectContext);
      const maxContinuousLoad = panel.busRating * panel.voltage * 0.8; // 80% rule
      const availableCapacity = maxContinuousLoad - currentLoad;
      const additionalLoad = params.additional_load_watts || 0;

      return {
        success: true,
        data: {
          panelName: panel.name,
          busRating: panel.busRating,
          currentLoadWatts: currentLoad,
          currentUtilization: (currentLoad / maxContinuousLoad) * 100,
          availableCapacityWatts: availableCapacity,
          additionalLoadWatts: additionalLoad,
          canAccommodate: additionalLoad <= availableCapacity,
          recommendation: additionalLoad > availableCapacity
            ? `Need ${Math.ceil((currentLoad + additionalLoad) / (panel.voltage * 0.8))}A panel`
            : null,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // RUN INSPECTION
  // -------------------------------------------------------------------------
  {
    name: 'run_inspection',
    description: 'Run NEC compliance inspection on the project or specific category',
    parameters: z.object({
      category: z.enum(['all', 'panels', 'circuits', 'grounding', 'feeders']).optional(),
      panel_name: z.string().optional(),
    }),
    execute: async (params, context) => {
      const result = await runInspection(
        context.projectContext,
        params.category || 'all'
      );

      return {
        success: true,
        data: {
          totalIssues: result.issues.length,
          critical: result.issues.filter(i => i.severity === 'critical').length,
          warnings: result.issues.filter(i => i.severity === 'warning').length,
          info: result.issues.filter(i => i.severity === 'info').length,
          issues: result.issues.slice(0, 10), // Top 10 issues
          overallScore: result.score,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // CONDUCTOR SIZING CHECK
  // -------------------------------------------------------------------------
  {
    name: 'check_conductor_sizing',
    description: 'Verify conductor is properly sized per NEC Table 310.16',
    parameters: z.object({
      circuit_id: z.string().optional(),
      circuit_number: z.number().optional(),
      panel_name: z.string().optional(),
      load_amps: z.number().optional(),
      conductor_size: z.string().optional(),
    }),
    execute: async (params, context) => {
      // Either use circuit data or provided values
      let loadAmps = params.load_amps;
      let conductorSize = params.conductor_size;

      if (!loadAmps || !conductorSize) {
        const circuit = findCircuit(params, context.projectContext);
        if (circuit) {
          loadAmps = loadAmps || circuit.load_watts / 120;
          conductorSize = conductorSize || circuit.conductor_size;
        }
      }

      const ampacity = getAmpacityFromTable310_16(conductorSize, 'Cu', 75);
      const compliant = ampacity >= loadAmps;

      return {
        success: true,
        data: {
          conductorSize,
          loadAmps,
          ampacity,
          compliant,
          necReference: 'Table 310.16',
          recommendation: !compliant
            ? `Upgrade to ${getMinimumConductorSize(loadAmps, 'Cu', 75)}`
            : null,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // ARC FLASH CALCULATION
  // -------------------------------------------------------------------------
  {
    name: 'calculate_arc_flash',
    description: 'Calculate arc flash incident energy and required PPE',
    parameters: z.object({
      panel_id: z.string().optional(),
      panel_name: z.string().optional(),
      working_distance_inches: z.number().optional(),
    }),
    execute: async (params, context) => {
      const panel = findPanel(params, context.projectContext);
      if (!panel) {
        return { success: false, error: 'Panel not found' };
      }

      const result = calculateArcFlash({
        panelId: panel.id,
        voltage: panel.voltage,
        availableFaultCurrent: await getAvailableFaultCurrent(panel),
        workingDistance: params.working_distance_inches || 18,
      });

      return {
        success: true,
        data: {
          panelName: panel.name,
          incidentEnergy: result.incidentEnergy,
          arcFlashBoundary: result.arcFlashBoundary,
          ppeCategory: result.ppeCategory,
          requiredPPE: result.requiredPPE,
          labelRequired: result.incidentEnergy > 1.2,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // SERVICE UPGRADE CHECK
  // -------------------------------------------------------------------------
  {
    name: 'check_service_upgrade',
    description: 'Analyze if service upgrade is needed for proposed loads',
    parameters: z.object({
      proposed_loads: z.array(z.object({
        description: z.string(),
        watts: z.number(),
      })).optional(),
      total_additional_watts: z.number().optional(),
    }),
    execute: async (params, context) => {
      const currentServiceAmps = context.projectContext.serviceAmps || 200;
      const currentLoad = context.projectContext.totalLoad.demandVA;
      const proposedLoad = params.total_additional_watts ||
        params.proposed_loads?.reduce((sum, l) => sum + l.watts, 0) || 0;

      const totalLoad = currentLoad + proposedLoad;
      const requiredAmps = Math.ceil(totalLoad / context.projectContext.serviceVoltage);
      const needsUpgrade = requiredAmps > currentServiceAmps * 0.8;

      return {
        success: true,
        data: {
          currentServiceAmps,
          currentLoadVA: currentLoad,
          proposedAdditionalVA: proposedLoad,
          totalLoadVA: totalLoad,
          currentUtilization: (currentLoad / (currentServiceAmps * context.projectContext.serviceVoltage)) * 100,
          projectedUtilization: (totalLoad / (currentServiceAmps * context.projectContext.serviceVoltage)) * 100,
          needsUpgrade,
          recommendedService: needsUpgrade ? getNextServiceSize(requiredAmps) : null,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // ADD CIRCUIT (requires confirmation)
  // -------------------------------------------------------------------------
  {
    name: 'add_circuit',
    description: 'Add a new circuit to a panel (requires user confirmation)',
    requiresConfirmation: true,
    parameters: z.object({
      panel_name: z.string(),
      description: z.string(),
      load_watts: z.number(),
      breaker_amps: z.number().optional(),
      pole: z.enum(['1', '2', '3']).optional(),
    }),
    execute: async (params, context) => {
      // For write operations, return confirmation request
      const panel = findPanel({ panel_name: params.panel_name }, context.projectContext);
      if (!panel) {
        return { success: false, error: 'Panel not found' };
      }

      const suggestedBreaker = getSuggestedBreakerSize(params.load_watts);
      const suggestedConductor = getMinimumConductorSize(suggestedBreaker, 'Cu', 75);
      const nextCircuitNumber = getNextAvailableCircuitNumber(panel);

      return {
        success: true,
        data: {
          action: 'confirm_add_circuit',
          panel: panel.name,
          circuitNumber: nextCircuitNumber,
          description: params.description,
          loadWatts: params.load_watts,
          suggestedBreaker,
          suggestedConductor,
          pole: params.pole || '1',
        },
        display: {
          type: 'confirmation',
          content: {
            title: 'Add New Circuit?',
            message: `Add ${params.description} (${params.load_watts}W) to ${panel.name}?`,
            details: {
              'Circuit #': nextCircuitNumber,
              'Breaker': `${suggestedBreaker}A`,
              'Conductor': suggestedConductor,
            },
          },
        },
      };
    },
  },
];
```

### Tool Executor

```typescript
// services/ai/toolExecutor.ts

export class ToolExecutor {
  private tools: Map<string, ChatTool>;
  private context: ToolContext;

  constructor(context: ToolContext) {
    this.context = context;
    this.tools = new Map(CHAT_TOOLS.map(t => [t.name, t]));
  }

  async execute(toolName: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    try {
      // Validate parameters
      const validatedParams = tool.parameters.parse(params);

      // Execute tool
      const result = await tool.execute(validatedParams, this.context);

      // Log for audit
      await logToolExecution(toolName, params, result, this.context);

      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error: `Invalid parameters: ${error.message}` };
      }
      return { success: false, error: error.message };
    }
  }

  getToolDefinitions(): GeminiToolDefinition[] {
    return CHAT_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    }));
  }
}
```

### Gemini Function Calling Integration

```typescript
// services/geminiService.ts (additions)

interface GeminiFunctionCall {
  name: string;
  args: Record<string, any>;
}

interface GeminiResponse {
  text?: string;
  functionCall?: GeminiFunctionCall;
}

export const askNecAssistantWithTools = async (
  question: string,
  conversationHistory: ChatMessage[],
  projectContext: ProjectContext
): Promise<ChatMessage> => {
  const toolExecutor = new ToolExecutor({
    projectId: projectContext.projectId,
    projectContext,
    userId: getCurrentUserId(),
  });

  const systemInstruction = buildAgenticSystemPrompt(projectContext);
  const tools = toolExecutor.getToolDefinitions();

  // First call - may return function call or direct response
  const response = await callGeminiWithTools({
    prompt: buildConversationPrompt(question, conversationHistory),
    systemInstruction,
    tools,
  });

  // If Gemini wants to call a tool
  if (response.functionCall) {
    const toolResult = await toolExecutor.execute(
      response.functionCall.name,
      response.functionCall.args
    );

    // Check if tool requires user confirmation
    if (toolResult.display?.type === 'confirmation') {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: formatConfirmationRequest(toolResult),
        timestamp: new Date(),
        metadata: {
          toolCalls: [{
            name: response.functionCall.name,
            args: response.functionCall.args,
            result: toolResult,
            status: 'pending_confirmation',
          }],
        },
      };
    }

    // Send tool result back to Gemini for natural language response
    const finalResponse = await callGeminiWithToolResult({
      originalQuestion: question,
      toolName: response.functionCall.name,
      toolResult: toolResult.data,
      conversationHistory,
    });

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: finalResponse,
      timestamp: new Date(),
      metadata: {
        toolCalls: [{
          name: response.functionCall.name,
          args: response.functionCall.args,
          result: toolResult,
          status: 'completed',
        }],
      },
    };
  }

  // Direct response (no tool needed)
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: response.text || 'No response generated.',
    timestamp: new Date(),
  };
};

function buildAgenticSystemPrompt(context: ProjectContext): string {
  return `
You are an NEC compliance AI copilot with access to calculation tools.
You can execute real calculations on the user's project data.

AVAILABLE TOOLS:
- calculate_voltage_drop: Calculate voltage drop for circuits
- calculate_short_circuit: Calculate fault current at panels
- check_panel_capacity: Check if panel can handle additional load
- run_inspection: Run NEC compliance audit
- check_conductor_sizing: Verify conductor sizing per Table 310.16
- calculate_arc_flash: Calculate incident energy and PPE requirements
- check_service_upgrade: Analyze service upgrade needs
- add_circuit: Add new circuit (requires confirmation)

WHEN TO USE TOOLS:
- User asks about specific values (voltage drop, fault current, etc.)
- User wants to check compliance
- User asks "what if" scenarios about adding loads
- User wants to run calculations

WHEN NOT TO USE TOOLS:
- General NEC questions (just answer directly)
- Explaining concepts or requirements
- User explicitly says "don't calculate" or "just explain"

PROJECT CONTEXT:
${formatContextForAI(context)}

Always be specific about which equipment you're analyzing.
After using a tool, explain the results in plain language.
Cite NEC articles when relevant.
  `;
}
```

### Edge Function Update

```typescript
// supabase/functions/gemini-proxy/index.ts (additions)

// Add function calling support
if (body.tools && body.tools.length > 0) {
  requestBody.tools = [{
    functionDeclarations: body.tools,
  }];
  requestBody.toolConfig = {
    functionCallingConfig: {
      mode: 'AUTO', // Let Gemini decide when to call tools
    },
  };
}

// Handle function call responses
const candidate = result.candidates?.[0];
if (candidate?.content?.parts?.[0]?.functionCall) {
  return new Response(JSON.stringify({
    functionCall: candidate.content.parts[0].functionCall,
  }), { headers });
}
```

---

## Phase 3: Streaming Responses

### Objective

Display tokens as they're generated for faster perceived response time.

### Implementation (Brief)

```typescript
// Use Gemini's streaming API
const stream = await callGeminiStream(prompt);

for await (const chunk of stream) {
  onChunk(chunk.text);
}
```

This phase is straightforward - primarily UI work to handle streaming display.

---

## Phase 4: Core NEC Tables RAG

### Objective

Embed the most critical NEC tables for accurate lookups.

### Priority Tables

| Table | Content | Use Case |
|-------|---------|----------|
| 310.16 | Conductor ampacity | Conductor sizing |
| 250.66 | GEC sizing | Grounding calcs |
| 250.122 | EGC sizing | Equipment grounding |
| 220.12 | Lighting loads | Load calculations |
| 220.42 | Lighting demand factors | Demand calcs |
| 220.55 | Cooking demand factors | Residential calcs |
| 430.52 | Motor protection | Motor circuits |

### Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE nec_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number TEXT NOT NULL,           -- "310.16"
  table_title TEXT NOT NULL,            -- "Conductor Ampacity"
  edition INTEGER NOT NULL DEFAULT 2023,
  content JSONB NOT NULL,               -- Structured table data
  description TEXT,                     -- Plain text description
  embedding VECTOR(1536),               -- OpenAI embedding
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON nec_tables USING ivfflat (embedding vector_cosine_ops);
```

---

## Phase 5: Full RAG

### Objective

Complete NEC knowledge base with article text and semantic search.

### Scope

- All NEC articles (800+)
- Informational notes and exceptions
- Multi-edition support (2020, 2023, 2026)
- User-uploaded PDF support (premium)

See detailed RAG architecture in earlier sections.

---

## Testing Strategy

### Unit Tests

```typescript
// tests/ai/chatTools.test.ts

describe('ChatTools', () => {
  describe('calculate_voltage_drop', () => {
    it('finds circuit by number', async () => {
      const result = await executeTool('calculate_voltage_drop', {
        circuit_number: 14,
        panel_name: 'Panel A',
      });
      expect(result.success).toBe(true);
      expect(result.data.circuitNumber).toBe(14);
    });

    it('returns error for missing circuit', async () => {
      const result = await executeTool('calculate_voltage_drop', {
        circuit_number: 999,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
```

### Integration Tests

```typescript
// tests/ai/agenticChat.test.ts

describe('Agentic Chat', () => {
  it('calls voltage drop tool when asked', async () => {
    const response = await askNecAssistantWithTools(
      "What's the voltage drop on circuit 14?",
      [],
      mockProjectContext
    );

    expect(response.metadata?.toolCalls).toHaveLength(1);
    expect(response.metadata?.toolCalls[0].name).toBe('calculate_voltage_drop');
    expect(response.content).toContain('voltage drop');
  });

  it('answers directly for general questions', async () => {
    const response = await askNecAssistantWithTools(
      "What is NEC article 250 about?",
      [],
      mockProjectContext
    );

    expect(response.metadata?.toolCalls).toBeUndefined();
    expect(response.content).toContain('grounding');
  });
});
```

---

## Rollout Plan

### Phase 1: Conversation Memory (Week 1)
- [ ] Create `useChat` hook
- [ ] Build conversation history formatter
- [ ] Update `askNecAssistant` with memory
- [ ] Create `ChatPanel` component
- [ ] Add "Clear History" functionality
- [ ] Test multi-turn conversations

### Phase 2: Agentic Actions (Weeks 2-3)
- [ ] Define tool schemas with Zod
- [ ] Implement tool executor
- [ ] Create helper functions (findCircuit, findPanel, etc.)
- [ ] Update Gemini Edge Function for function calling
- [ ] Implement 7 core tools
- [ ] Add confirmation flow for write operations
- [ ] Test tool execution
- [ ] Integration testing

### Phase 3: Streaming (Week 4)
- [ ] Update Edge Function for streaming
- [ ] Create streaming display component
- [ ] Handle partial responses

### Phase 4-5: RAG (Weeks 5-8)
- [ ] Set up pgvector in Supabase
- [ ] Transcribe priority NEC tables
- [ ] Build embedding pipeline
- [ ] Create retrieval service
- [ ] Integrate with chat flow

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Avg. questions per session | 1.2 | 4+ |
| Calculation accuracy | N/A (manual) | 95%+ via tools |
| User satisfaction | Unknown | 4.5/5 stars |
| Time to answer | 3-5s | <2s (streaming) |
| NEC citation accuracy | ~70% (guessed) | 95%+ (RAG) |

---

## Appendix: File Structure

```
services/
├── ai/
│   ├── chatTools.ts          # Tool definitions
│   ├── toolExecutor.ts       # Tool execution engine
│   ├── conversationBuilder.ts # History formatting
│   └── projectContextBuilder.ts # (existing)
├── geminiService.ts          # (enhanced with tools)
└── rag/                      # Phase 4-5
    ├── embeddings.ts
    └── retrieval.ts

hooks/
├── useChat.ts                # Chat state management
└── useChatPersistence.ts     # Optional DB persistence

components/
├── ChatPanel.tsx             # Main chat UI
├── ChatMessage.tsx           # Message bubble
├── ToolResultDisplay.tsx     # Tool output formatting
└── ConfirmationDialog.tsx    # Write action confirmation

types/
└── chat.ts                   # Chat-related types
```
