import { useState, useEffect, FC } from 'react';

export interface EmergencyTimerProps {
  createdAt: string | Date;
}

export const EmergencyTimer: FC<EmergencyTimerProps> = ({ createdAt }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const createdTime = new Date(createdAt).getTime();
      const deadlineTime = createdTime + 30 * 60 * 1000; // +30 минут
      const difference = deadlineTime - Date.now();

      return difference > 0 ? Math.floor(difference / 1000) : 0;
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  if (timeLeft <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-red-600 text-white animate-pulse">
        ПРОСРОЧЕНО
      </span>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const textColor =
    minutes < 5
      ? 'text-red-600 dark:text-red-400 font-black animate-pulse'
      : 'text-amber-600 dark:text-amber-400 font-bold';

  return <span className={`font-mono text-sm ${textColor}`}>⏱️ {formattedTime}</span>;
};