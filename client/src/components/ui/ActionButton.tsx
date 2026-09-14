import { ButtonHTMLAttributes, FC, ReactNode } from 'react';

export type ButtonVariant = 'gray' | 'emerald' | 'blue';

const VARIANTS: Record<ButtonVariant, string> = {
  gray: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white',
  blue: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white',
};

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export const ActionButton: FC<ActionButtonProps> = ({
  variant = 'gray',
  className = '',
  children,
  ...props
}) => {
  return (
    <button
      type="button"
      className={`${VARIANTS[variant]} font-medium text-sm px-4 py-2 rounded-lg transition-colors shadow-sm ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};