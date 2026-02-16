/**
 * Loading Spinner Component
 * Reusable loading indicators for async operations
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  /** Size of the spinner (default: 'md') */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional text to display below spinner */
  text?: string;
  /** Fullscreen overlay mode */
  fullscreen?: boolean;
  /** Center in container */
  center?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg'
};

/**
 * Loading Spinner
 *
 * @example
 * // Basic spinner
 * <LoadingSpinner />
 *
 * @example
 * // With text
 * <LoadingSpinner text="Loading project..." size="lg" />
 *
 * @example
 * // Fullscreen overlay
 * <LoadingSpinner fullscreen text="Processing..." />
 *
 * @example
 * // Centered in container
 * <LoadingSpinner center text="Loading..." />
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  fullscreen = false,
  center = false
}) => {
  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${center ? 'min-h-[200px]' : ''}`}>
      <Loader2 className={`${sizeClasses[size]} text-[#2d3b2d] animate-spin`} />
      {text && (
        <p className={`${textSizeClasses[size]} text-gray-600 font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};

/**
 * Inline Loading Spinner
 * Minimal spinner for inline use (e.g., button loading state)
 */
export const InlineSpinner: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  return (
    <Loader2 className={`${sizeClasses[size]} text-current animate-spin`} />
  );
};

/**
 * Loading Overlay
 * Semi-transparent overlay with spinner for sections
 */
export const LoadingOverlay: React.FC<{ text?: string }> = ({ text }) => {
  return (
    <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
};

/**
 * Empty State Component
 * Displays when no data is available
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-4 max-w-md">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-[#2d3b2d] hover:bg-[#3d4f3d] text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
