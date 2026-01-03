/**
 * Tooltip Component
 * Contextual help tooltips for user guidance
 */

import React, { useState } from 'react';
import { HelpCircle, Info, AlertCircle } from 'lucide-react';

interface TooltipProps {
  /** Tooltip content */
  content: string;
  /** Tooltip position relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Icon variant */
  variant?: 'help' | 'info' | 'warning';
  /** Children (tooltip trigger element) */
  children?: React.ReactNode;
  /** Custom trigger icon size */
  iconSize?: 'sm' | 'md' | 'lg';
}

const iconSizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5'
};

const variantClasses = {
  help: 'text-gray-400 hover:text-electric-600',
  info: 'text-blue-400 hover:text-blue-600',
  warning: 'text-orange-400 hover:text-orange-600'
};

const variantIcons = {
  help: HelpCircle,
  info: Info,
  warning: AlertCircle
};

/**
 * Tooltip Component
 *
 * @example
 * // Basic help tooltip
 * <Tooltip content="This is the main distribution panel">
 *   <span>MDP</span>
 * </Tooltip>
 *
 * @example
 * // Icon-only tooltip
 * <Tooltip content="NEC 220.82 standard method for dwelling load calculations" variant="help" />
 *
 * @example
 * // Warning tooltip
 * <Tooltip content="This will delete all circuits in this panel" variant="warning" />
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  variant = 'help',
  children,
  iconSize = 'sm'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const Icon = variantIcons[variant];

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent'
  };

  return (
    <div className="relative inline-flex items-center">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="inline-flex items-center cursor-help"
      >
        {children || (
          <Icon className={`${iconSizeClasses[iconSize]} ${variantClasses[variant]} transition-colors`} />
        )}
      </div>

      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]}`}
          role="tooltip"
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg">
            {content}
            <div
              className={`absolute w-0 h-0 border-4 border-gray-900 ${arrowClasses[position]}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Help Text Component
 * Inline help text with optional tooltip for more details
 */
interface HelpTextProps {
  /** Short help text (always visible) */
  text: string;
  /** Detailed help (shows in tooltip) */
  detailedHelp?: string;
  /** Style variant */
  variant?: 'default' | 'warning' | 'info';
}

export const HelpText: React.FC<HelpTextProps> = ({
  text,
  detailedHelp,
  variant = 'default'
}) => {
  const colorClasses = {
    default: 'text-gray-500',
    warning: 'text-orange-600',
    info: 'text-blue-600'
  };

  return (
    <div className={`flex items-start gap-2 text-xs ${colorClasses[variant]} mt-1`}>
      <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
      <span className="flex-1">
        {text}
        {detailedHelp && (
          <>
            {' '}
            <Tooltip content={detailedHelp} variant="info" iconSize="sm" />
          </>
        )}
      </span>
    </div>
  );
};

/**
 * NEC Reference Component
 * Shows NEC article reference with tooltip explanation
 */
interface NecReferenceProps {
  /** NEC article number (e.g., "220.82", "250.122") */
  article: string;
  /** Explanation of what this article covers */
  explanation: string;
  /** Optional link to full article */
  link?: string;
}

export const NecReference: React.FC<NecReferenceProps> = ({
  article,
  explanation,
  link
}) => {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
        NEC {article}
      </span>
      <Tooltip
        content={explanation}
        variant="info"
      />
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-electric-600 hover:text-electric-700 hover:underline"
        >
          View
        </a>
      )}
    </span>
  );
};

/**
 * Feature Badge with Tooltip
 * Shows feature status/availability with explanation
 */
interface FeatureBadgeProps {
  /** Badge label */
  label: string;
  /** Tooltip explanation */
  description: string;
  /** Badge variant */
  variant?: 'beta' | 'new' | 'pro' | 'coming-soon';
}

export const FeatureBadge: React.FC<FeatureBadgeProps> = ({
  label,
  description,
  variant = 'beta'
}) => {
  const variantClasses = {
    beta: 'bg-blue-100 text-blue-700 border-blue-200',
    new: 'bg-green-100 text-green-700 border-green-200',
    pro: 'bg-purple-100 text-purple-700 border-purple-200',
    'coming-soon': 'bg-gray-100 text-gray-600 border-gray-200'
  };

  return (
    <Tooltip content={description} variant="info">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold border rounded-full ${variantClasses[variant]}`}
      >
        {label}
      </span>
    </Tooltip>
  );
};

/**
 * Field Help
 * Help icon next to form fields
 */
interface FieldHelpProps {
  /** Help text */
  text: string;
  /** Optional NEC article reference */
  necArticle?: string;
}

export const FieldHelp: React.FC<FieldHelpProps> = ({ text, necArticle }) => {
  const content = necArticle ? `${text}\n\nReferences: NEC ${necArticle}` : text;

  return (
    <Tooltip content={content} variant="help" position="right" />
  );
};
