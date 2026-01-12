/**
 * Conversation Builder for AI Chatbot
 *
 * Builds conversation history prompts for multi-turn chat with the NEC Assistant.
 * Handles context management to keep conversations coherent while managing token limits.
 *
 * @module services/ai/conversationBuilder
 */

import type { ChatMessage, ConversationContextSettings } from '@/types';

// Default settings for conversation context
const DEFAULT_SETTINGS: ConversationContextSettings = {
  maxHistoryMessages: 10,
  includeProjectContext: true,
  projectContextFrequency: 'first',
};

// Approximate token limit for conversation history
const MAX_HISTORY_TOKENS = 4000;

/**
 * Estimates token count for a string (rough approximation)
 * Uses ~4 characters per token as a rough estimate
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Builds formatted conversation history from messages
 *
 * @param messages - Array of chat messages
 * @param maxMessages - Maximum number of messages to include
 * @returns Formatted conversation history string
 */
export function buildConversationHistory(
  messages: ChatMessage[],
  maxMessages: number = DEFAULT_SETTINGS.maxHistoryMessages
): string {
  if (messages.length === 0) return '';

  // Take the most recent messages (excluding the current one being sent)
  const recentMessages = messages.slice(-maxMessages);

  // Build history string, respecting token limits
  let history = '';
  let tokenCount = 0;

  for (const msg of recentMessages) {
    const formattedMsg = `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    const msgTokens = estimateTokens(formattedMsg);

    if (tokenCount + msgTokens > MAX_HISTORY_TOKENS) {
      // Add truncation notice if we're cutting off history
      if (history) {
        history = '[Earlier conversation truncated for brevity]\n\n' + history;
      }
      break;
    }

    history += formattedMsg;
    tokenCount += msgTokens;
  }

  return history.trim();
}

/**
 * Summarizes conversation history when it gets too long
 *
 * @param messages - Array of chat messages
 * @returns Summarized history string
 */
export function summarizeConversationHistory(messages: ChatMessage[]): string {
  if (messages.length === 0) return '';
  if (messages.length <= 4) return buildConversationHistory(messages);

  // For longer conversations, summarize older messages and keep recent ones
  const recentCount = 4;
  const recentMessages = messages.slice(-recentCount);
  const olderMessages = messages.slice(0, -recentCount);

  // Create a summary of older messages
  const topics = new Set<string>();
  for (const msg of olderMessages) {
    // Extract key topics (simplified - could use AI for better summarization)
    const words = msg.content.toLowerCase().split(/\s+/);
    const necArticles = msg.content.match(/NEC\s*\d+\.\d+/gi) || [];
    necArticles.forEach(article => topics.add(article));

    // Look for common electrical terms
    const electricalTerms = ['panel', 'circuit', 'voltage', 'amp', 'grounding', 'breaker', 'conductor', 'feeder'];
    for (const term of electricalTerms) {
      if (words.some(w => w.includes(term))) {
        topics.add(term);
      }
    }
  }

  let summary = '';
  if (topics.size > 0) {
    summary = `[Previous discussion covered: ${Array.from(topics).slice(0, 8).join(', ')}]\n\n`;
  }

  // Add recent messages in full
  summary += 'Recent messages:\n' + buildConversationHistory(recentMessages, recentCount);

  return summary;
}

/**
 * Builds the enhanced prompt for the AI with conversation context
 *
 * @param currentQuestion - The user's current question
 * @param conversationHistory - Formatted conversation history
 * @param projectContext - Project context string (from projectContextBuilder)
 * @param isFirstMessage - Whether this is the first message in the conversation
 * @returns Complete prompt string
 */
export function buildEnhancedPrompt(
  currentQuestion: string,
  conversationHistory: string,
  projectContext: string,
  isFirstMessage: boolean
): string {
  let prompt = '';

  // Include full project context on first message only
  if (isFirstMessage && projectContext) {
    prompt += projectContext + '\n\n';
  }

  // Include conversation history for follow-up messages
  if (conversationHistory && !isFirstMessage) {
    prompt += `PREVIOUS CONVERSATION:\n${conversationHistory}\n\n`;
  }

  // Add the current question
  prompt += `CURRENT QUESTION: ${currentQuestion}`;

  // Add follow-up instructions if this is not the first message
  if (!isFirstMessage) {
    prompt += `

INSTRUCTIONS FOR FOLLOW-UP:
- Reference previous messages when relevant
- Build on prior context instead of repeating information
- If the user references something from earlier, acknowledge it
- Keep track of any decisions or recommendations made earlier`;
  }

  return prompt;
}

/**
 * Builds the system instruction for conversation-aware chat
 *
 * @param projectContext - Project context string (optional, for reference)
 * @param isFirstMessage - Whether this is the first message
 * @returns Enhanced system instruction
 */
export function buildConversationSystemInstruction(
  projectContext?: string,
  isFirstMessage: boolean = true
): string {
  return `
You are a Senior Electrical Engineer and Master Electrician specializing in the National Electrical Code (NEC).
You are working as an AI copilot for electrical design and NEC compliance.

CONVERSATION CAPABILITIES:
- You have memory of our conversation and can reference previous questions/answers
- Build on prior context instead of repeating information
- If the user references something discussed earlier, acknowledge and connect to it
- Track decisions, recommendations, and calculations made during our conversation

${projectContext && isFirstMessage ? `
PROJECT CONTEXT:
You have access to the user's current project data. When answering questions:
1. Reference specific panels, circuits, or feeders from the project when relevant
2. Check if the question relates to their actual project configuration
3. Provide specific recommendations based on their project data
4. If they ask about a panel/circuit/feeder, look it up in the project context
` : ''}

RESPONSE GUIDELINES:
- Always reference specific NEC articles (using the 2023 edition unless specified otherwise)
- Be concise, technical, and professional
- When referencing earlier discussion points, use phrases like "As we discussed..." or "Building on the earlier analysis..."
- If you need clarification about something discussed earlier, ask

${!isFirstMessage ? `
FOLLOW-UP CONTEXT:
This is a follow-up message in an ongoing conversation. The user may be:
- Asking for clarification on a previous answer
- Building on a previous recommendation
- Requesting additional calculations or analysis
- Changing parameters from an earlier scenario
` : ''}
  `.trim();
}

/**
 * Determines if project context should be included based on settings
 *
 * @param messageCount - Number of messages in the conversation
 * @param settings - Conversation context settings
 * @returns Whether to include project context
 */
export function shouldIncludeProjectContext(
  messageCount: number,
  settings: ConversationContextSettings = DEFAULT_SETTINGS
): boolean {
  if (!settings.includeProjectContext) return false;

  switch (settings.projectContextFrequency) {
    case 'first':
      return messageCount === 0;
    case 'always':
      return true;
    case 'summarized':
      // Include full on first, summarized on subsequent
      return messageCount === 0;
    default:
      return messageCount === 0;
  }
}

/**
 * Creates a context hash for caching purposes
 * Used to detect if context has changed significantly
 *
 * @param projectContext - Project context string
 * @param conversationLength - Number of messages in conversation
 * @returns Hash string
 */
export function createContextHash(projectContext: string, conversationLength: number): string {
  // Simple hash based on context length and key identifiers
  const contextSummary = projectContext.slice(0, 200);
  return `${contextSummary.length}-${conversationLength}-${Date.now().toString(36)}`;
}
