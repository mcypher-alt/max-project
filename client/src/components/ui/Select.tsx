import { FC, SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const Select: FC<SelectProps> = ({ className = '', children, ...props }) => {
  return (
    <select
      className={`bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none transition-colors disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
};