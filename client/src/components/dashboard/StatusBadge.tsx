import { FC } from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: FC<StatusBadgeProps> = ({ status }) => {
  if (status === 'completed') {
    return <span className="text-green-600 dark:text-green-400 font-bold">Завершен</span>;
  }
  if (status === 'in_work') {
    return <span className="text-yellow-600 dark:text-yellow-500 font-bold">В процессе</span>;
  }
  return <span className="text-cyan-600 dark:text-cyan-400 font-bold">Новое</span>;
};