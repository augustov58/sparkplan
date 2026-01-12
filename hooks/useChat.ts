/**
 * useChat Hook
 *
 * Manages chat state and interactions with the NEC Assistant.
 * Provides conversation memory, message handling, and project context integration.
 *
 * @module hooks/useChat
 */

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ChatMessageMetadata } from '@/types';
import { askNecAssistantWithMemory } from '@/services/geminiService';
import { buildProjectContext, formatContextForAI } from '@/services/ai/projectContextBuilder';
import { buildConversationHistory } from '@/services/ai/conversationBuilder';
import { usePanels } from './usePanels';
import { useCircuits } from './useCircuits';
import { useFeeders } from './useFeeders';
import { useTransformers } from './useTransformers';

export interface UseChatOptions {
  /** Maximum number of messages to keep in history */
  maxHistoryMessages?: number;
  /** Whether to include project context in conversations */
  includeProjectContext?: boolean;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

export interface UseChatReturn {
  /** Array of chat messages */
  messages: ChatMessage[];
  /** Whether a message is currently being processed */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Send a new message to the assistant */
  sendMessage: (content: string) => Promise<void>;
  /** Clear all messages and start fresh */
  clearHistory: () => void;
  /** Retry the last failed message */
  retryLastMessage: () => Promise<void>;
  /** Whether this is the first message in the conversation */
  isFirstMessage: boolean;
}

/**
 * Hook for managing chat conversations with the NEC Assistant
 *
 * @param projectId - The current project ID
 * @param projectName - The project name
 * @param projectType - The project type (Residential, Commercial, Industrial)
 * @param serviceVoltage - Service voltage
 * @param servicePhase - Service phase (1 or 3)
 * @param options - Optional configuration
 * @returns Chat state and methods
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, isLoading } = useChat(
 *   project.id,
 *   project.name,
 *   project.type,
 *   project.serviceVoltage,
 *   project.servicePhase
 * );
 *
 * // Send a message
 * await sendMessage("What's the voltage drop on Circuit 14?");
 * ```
 */
export function useChat(
  projectId: string,
  projectName: string,
  projectType: 'Residential' | 'Commercial' | 'Industrial',
  serviceVoltage: number,
  servicePhase: 1 | 3,
  options: UseChatOptions = {}
): UseChatReturn {
  const {
    maxHistoryMessages = 10,
    includeProjectContext = true,
    onError,
  } = options;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track the last user message for retry functionality
  const lastUserMessageRef = useRef<string | null>(null);

  // Get project data for context
  const { panels } = usePanels(projectId);
  const { circuits } = useCircuits(projectId);
  const { feeders } = useFeeders(projectId);
  const { transformers } = useTransformers(projectId);

  /**
   * Generates a unique message ID
   */
  const generateMessageId = useCallback((): string => {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  /**
   * Builds the project context string
   */
  const getProjectContext = useCallback((): string => {
    if (!includeProjectContext) return '';

    try {
      // Cast to any to handle type differences between types.ts and database.types.ts
      // This is a known type mismatch in the codebase
      const context = buildProjectContext(
        projectId,
        projectName,
        projectType,
        serviceVoltage,
        servicePhase,
        panels as any,
        circuits as any,
        feeders as any,
        transformers as any
      );
      return formatContextForAI(context);
    } catch (err) {
      console.warn('Failed to build project context:', err);
      return '';
    }
  }, [
    includeProjectContext,
    projectId,
    projectName,
    projectType,
    serviceVoltage,
    servicePhase,
    panels,
    circuits,
    feeders,
    transformers,
  ]);

  /**
   * Sends a message to the NEC Assistant
   */
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim()) return;

    const trimmedContent = content.trim();
    lastUserMessageRef.current = trimmedContent;
    setError(null);

    // Create user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: trimmedContent,
      timestamp: new Date(),
    };

    // Add user message to state
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const startTime = Date.now();

    try {
      // Build conversation history from existing messages
      const conversationHistory = buildConversationHistory(messages, maxHistoryMessages);

      // Get project context (only for first message or if configured)
      const isFirst = messages.length === 0;
      const projectContext = isFirst ? getProjectContext() : '';

      // Call the AI service with memory
      const response = await askNecAssistantWithMemory(
        trimmedContent,
        conversationHistory,
        projectContext,
        isFirst
      );

      const processingTime = Date.now() - startTime;

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        metadata: {
          projectContextIncluded: isFirst && !!projectContext,
          processingTimeMs: processingTime,
        } as ChatMessageMetadata,
      };

      // Add assistant message to state
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
      setError(errorMessage);
      onError?.(errorMessage);

      // Add error message to conversation
      const errorMsg: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
        metadata: {
          processingTimeMs: Date.now() - startTime,
        },
      };
      setMessages(prev => [...prev, errorMsg]);

    } finally {
      setIsLoading(false);
    }
  }, [messages, maxHistoryMessages, getProjectContext, generateMessageId, onError]);

  /**
   * Clears all messages and starts a fresh conversation
   */
  const clearHistory = useCallback((): void => {
    setMessages([]);
    setError(null);
    lastUserMessageRef.current = null;
  }, []);

  /**
   * Retries the last failed message
   */
  const retryLastMessage = useCallback(async (): Promise<void> => {
    if (!lastUserMessageRef.current) return;

    // Remove the last error message if present
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === 'assistant' && lastMsg.content.includes('encountered an error')) {
        return prev.slice(0, -2); // Remove both user and error messages
      }
      return prev.slice(0, -1); // Just remove the last message
    });

    // Retry sending
    await sendMessage(lastUserMessageRef.current);
  }, [sendMessage]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    retryLastMessage,
    isFirstMessage: messages.length === 0,
  };
}

/**
 * Hook for chat without project context (general NEC questions)
 *
 * @param options - Optional configuration
 * @returns Chat state and methods
 */
export function useChatGeneral(options: Omit<UseChatOptions, 'includeProjectContext'> = {}): UseChatReturn {
  // Use empty/default values when no project context is needed
  return useChat(
    '',
    'General',
    'Commercial',
    480,
    3,
    { ...options, includeProjectContext: false }
  );
}
