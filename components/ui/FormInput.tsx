/**
 * Form Input Components
 * Consistent form inputs with validation and error handling
 */

import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface BaseInputProps {
  /** Input label */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Success message to display */
  success?: string;
  /** Help text below input */
  helpText?: string;
  /** Required field indicator */
  required?: boolean;
  /** Full width input */
  fullWidth?: boolean;
}

interface TextInputProps extends BaseInputProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input icon (left side) */
  icon?: React.ReactNode;
}

/**
 * Text Input with validation
 *
 * @example
 * <TextInput
 *   label="Project Name"
 *   value={name}
 *   onChange={e => setName(e.target.value)}
 *   required
 *   error={nameError}
 * />
 */
export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  success,
  helpText,
  required,
  fullWidth = false,
  icon,
  className = '',
  ...props
}) => {
  const hasError = !!error;
  const hasSuccess = !!success;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        <input
          className={`
            block w-full rounded-lg border
            ${icon ? 'pl-10' : 'pl-3'}
            pr-10 py-2 text-sm
            transition-colors
            focus:outline-none focus:ring-2
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${hasError
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : hasSuccess
              ? 'border-green-300 focus:border-green-500 focus:ring-green-200'
              : 'border-gray-300 focus:border-electric-500 focus:ring-electric-200'
            }
            ${className}
          `}
          {...props}
        />

        {(hasError || hasSuccess) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {hasError && <AlertCircle className="w-4 h-4 text-red-500" />}
            {hasSuccess && <CheckCircle className="w-4 h-4 text-green-500" />}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {success && !error && (
        <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {success}
        </p>
      )}

      {helpText && !error && !success && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

interface TextAreaProps extends BaseInputProps, React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * TextArea with validation
 */
export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  success,
  helpText,
  required,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const hasError = !!error;
  const hasSuccess = !!success;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <textarea
        className={`
          block w-full rounded-lg border px-3 py-2 text-sm
          transition-colors
          focus:outline-none focus:ring-2
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${hasError
            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
            : hasSuccess
            ? 'border-green-300 focus:border-green-500 focus:ring-green-200'
            : 'border-gray-300 focus:border-electric-500 focus:ring-electric-200'
          }
          ${className}
        `}
        {...props}
      />

      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {success && !error && (
        <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {success}
        </p>
      )}

      {helpText && !error && !success && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

interface SelectProps extends BaseInputProps, React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Select dropdown with validation
 */
export const Select: React.FC<SelectProps> = ({
  label,
  error,
  success,
  helpText,
  required,
  fullWidth = false,
  className = '',
  children,
  ...props
}) => {
  const hasError = !!error;
  const hasSuccess = !!success;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <select
        className={`
          block w-full rounded-lg border px-3 py-2 text-sm
          transition-colors
          focus:outline-none focus:ring-2
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${hasError
            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
            : hasSuccess
            ? 'border-green-300 focus:border-green-500 focus:ring-green-200'
            : 'border-gray-300 focus:border-electric-500 focus:ring-electric-200'
          }
          ${className}
        `}
        {...props}
      >
        {children}
      </select>

      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {success && !error && (
        <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {success}
        </p>
      )}

      {helpText && !error && !success && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

/**
 * Checkbox with label
 */
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  className = '',
  ...props
}) => {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        className={`
          mt-1 w-4 h-4 rounded border-gray-300
          text-electric-500 focus:ring-electric-500
          transition-colors
          disabled:cursor-not-allowed disabled:opacity-50
          ${className}
        `}
        {...props}
      />
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-700 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Form validation helper
 */
export const FormErrors: React.FC<{ errors: string[] }> = ({ errors }) => {
  if (errors.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-800 mb-1">
            Please fix the following errors:
          </h4>
          <ul className="text-sm text-red-700 space-y-0.5 list-disc list-inside">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
