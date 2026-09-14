import React from 'react';

interface SwipeToCompleteProps {
  onComplete: () => void;
}

export function SwipeToComplete({ onComplete }: SwipeToCompleteProps) {
  const handleSwipe = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    if (parseInt(target.value) > 80) {
      onComplete();
    }
    target.value = "0"; // Сбрасываем ползунок обратно
  };

  return (
    <div className="relative h-14 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex items-center justify-center shadow-inner group">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="absolute text-sm font-bold text-gray-500 dark:text-gray-400 pointer-events-none tracking-wide">
        Свайпните вправо для завершения ➔
      </span>
      <input 
        type="range" 
        min="0" max="100" defaultValue="0"
        className="w-full h-full opacity-0 cursor-grab active:cursor-grabbing absolute z-10"
        onMouseUp={handleSwipe}
        onTouchEnd={handleSwipe}
      />
    </div>
  );
}