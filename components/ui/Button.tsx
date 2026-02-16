/**
 * Button Component System
 * Reusable button variants for consistent UI styling
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Loading state - shows spinner and disables button */
  loading?: boolean;
  /** Icon to show before text */
  icon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Children (button text/content) */
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#2d3b2d] hover:bg-[#3d4f3d] text-white shadow-sm disabled:bg-gray-300',
  secondary: 'bg-[#1a1a1a] hover:bg-[#333] text-white shadow-sm disabled:bg-gray-300',
  danger: 'bg-[#c44] hover:bg-[#a33] text-white shadow-sm disabled:bg-red-300',
  ghost: 'bg-transparent hover:bg-[#f0eeeb] text-[#1a1a1a] disabled:text-[#888]',
  outline: 'bg-white hover:bg-[#faf9f7] text-[#1a1a1a] border border-[#e8e6e3] disabled:border-[#e8e6e3] disabled:text-[#888]'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-6 py-3 gap-2'
};

/**
 * Button Component
 *
 * @example
 * // Primary button
 * <Button variant="primary">Save Changes</Button>
 *
 * @example
 * // Button with icon and loading state
 * <Button variant="primary" icon={<Save className="w-4 h-4" />} loading={isSaving}>
 *   Save
 * </Button>
 *
 * @example
 * // Danger button
 * <Button variant="danger" size="sm" onClick={handleDelete}>
 *   Delete
 * </Button>
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`
        inline-flex items-center justify-center
        font-medium rounded-lg
        transition-colors
        disabled:cursor-not-allowed disabled:opacity-60
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
};

/**
 * Icon Button
 * Square button for icon-only actions
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const iconButtonSizeClasses: Record<ButtonSize, string> = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-3'
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`
        inline-flex items-center justify-center
        rounded-lg
        transition-colors
        disabled:cursor-not-allowed disabled:opacity-60
        ${variantClasses[variant]}
        ${iconButtonSizeClasses[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    </button>
  );
};

/**
 * Button Group
 * Groups buttons together with connected appearance
 */
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className = '' }) => {
  return (
    <div className={`inline-flex rounded-lg shadow-sm ${className}`} role="group">
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;

        const isFirst = index === 0;
        const isLast = index === React.Children.count(children) - 1;

        return React.cloneElement(child as React.ReactElement<any>, {
          className: `
            ${child.props.className || ''}
            ${!isFirst ? '-ml-px' : ''}
            ${!isFirst && !isLast ? 'rounded-none' : ''}
            ${isFirst && !isLast ? 'rounded-r-none' : ''}
            ${isLast && !isFirst ? 'rounded-l-none' : ''}
          `
        });
      })}
    </div>
  );
};
