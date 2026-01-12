/**
 * ChatPanel Component
 *
 * Main chat interface for the NEC Assistant with conversation memory.
 * Displays message history, handles input, and shows loading states.
 *
 * @module components/ChatPanel
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  RefreshCw,
  Bot,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
  Clock,
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import type { ChatMessage } from '@/types';

interface ChatPanelProps {
  projectId: string;
  projectName: string;
  projectType: 'Residential' | 'Commercial' | 'Industrial';
  serviceVoltage: number;
  servicePhase: 1 | 3;
  /** Optional CSS class for the container */
  className?: string;
  /** Optional height constraint */
  height?: string;
}

/**
 * Individual chat message bubble
 */
const ChatMessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.content.includes('encountered an error');

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-blue-100 text-blue-600'
            : isError
            ? 'bg-red-100 text-red-600'
            : 'bg-emerald-100 text-emerald-600'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : isError
            ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-md'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}
      >
        {/* Message content with markdown-like formatting */}
        <div className="text-sm whitespace-pre-wrap">
          {message.content.split('\n').map((line, i) => {
            // Simple markdown-like formatting
            if (line.startsWith('**') && line.endsWith('**')) {
              return (
                <p key={i} className="font-semibold">
                  {line.slice(2, -2)}
                </p>
              );
            }
            if (line.startsWith('- ')) {
              return (
                <p key={i} className="pl-2">
                  {'\u2022'} {line.slice(2)}
                </p>
              );
            }
            if (line.match(/^NEC\s*\d+\.\d+/)) {
              return (
                <p key={i} className={`${isUser ? 'text-blue-100' : 'text-emerald-700'} font-medium`}>
                  {line}
                </p>
              );
            }
            return <p key={i}>{line || '\u00A0'}</p>;
          })}
        </div>

        {/* Metadata footer */}
        {message.metadata?.processingTimeMs && !isUser && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{(message.metadata.processingTimeMs / 1000).toFixed(1)}s</span>
            {message.metadata.projectContextIncluded && (
              <>
                <span className="mx-1">•</span>
                <Sparkles className="w-3 h-3" />
                <span>Project context</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Typing indicator shown while AI is responding
 */
const TypingIndicator: React.FC = () => (
  <div className="flex gap-3">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
      <Bot className="w-4 h-4" />
    </div>
    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

/**
 * Welcome message shown when chat is empty
 */
const WelcomeMessage: React.FC<{ projectName: string }> = ({ projectName }) => (
  <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
      <Sparkles className="w-8 h-8" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">NEC Assistant</h3>
    <p className="text-sm text-gray-500 mb-4 max-w-sm">
      I'm your AI copilot for electrical design. I have context about your project "{projectName}" and can help with:
    </p>
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      {[
        'NEC compliance questions',
        'Load calculations',
        'Conductor sizing',
        'Grounding requirements',
        'Inspection prep',
      ].map((topic) => (
        <span
          key={topic}
          className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
        >
          {topic}
        </span>
      ))}
    </div>
    <p className="text-xs text-gray-400">
      Type a question below to get started. I'll remember our conversation!
    </p>
  </div>
);

/**
 * Main ChatPanel component
 */
export function ChatPanel({
  projectId,
  projectName,
  projectType,
  serviceVoltage,
  servicePhase,
  className = '',
  height = 'h-[500px]',
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    sendMessage,
    isLoading,
    error,
    clearHistory,
    retryLastMessage,
    isFirstMessage,
  } = useChat(projectId, projectName, projectType, serviceVoltage, servicePhase);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`flex flex-col bg-white rounded-lg border shadow-sm ${height} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">NEC Assistant</h3>
            <p className="text-xs text-gray-500">
              {messages.length === 0
                ? 'Start a conversation'
                : `${messages.length} message${messages.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {error && (
            <button
              onClick={retryLastMessage}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Retry last message"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <WelcomeMessage projectName={projectName} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-3 border-t bg-gray-50 rounded-b-lg">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isFirstMessage
                ? 'Ask about NEC compliance, your project...'
                : 'Ask a follow-up question...'
            }
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        {isFirstMessage && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            Project context will be included with your first message
          </p>
        )}
      </form>
    </div>
  );
}

export default ChatPanel;
