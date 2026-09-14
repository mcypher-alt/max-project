import React from 'react';
import type { Ticket } from '../../types.js';
import { EmergencyTimer } from './EmergencyTimer';
import { SwipeToComplete } from './SwipeToComplete';

interface TicketCardProps {
  ticket: Ticket;
  onAccept: (ticketId: number) => void;
  onComplete: (ticketId: number) => void;
}

export function TicketCard({ ticket, onAccept, onComplete }: TicketCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border-l-4 transition-colors relative overflow-hidden ${
      ticket.type === 'emergency' 
        ? 'border-red-500 dark:border-red-500' 
        : 'border-cyan-400 dark:border-cyan-500'
    }`}>
      {/* Шапка */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-md uppercase tracking-wider">
            #{ticket.id}
          </span>
          {ticket.type === 'emergency' && (
            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-[10px] font-bold rounded-md uppercase tracking-wider">
              Экстренно
            </span>
          )}
        </div>
        
        {ticket.type === 'emergency' && (
          <EmergencyTimer createdAt={ticket.createdAt} />
        )}
      </div>

      {/* Инфо */}
      <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight mb-2">
        {ticket.address}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50">
        {ticket.description}
      </p>
      
      {/* Экшены */}
      {ticket.status === 'new' && (
        <button 
          onClick={() => onAccept(ticket.id)}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
        >
          Взять в работу
        </button>
      )}

      {ticket.status === 'in_work' && (
        <SwipeToComplete onComplete={() => onComplete(ticket.id)} />
      )}
    </div>
  );
}