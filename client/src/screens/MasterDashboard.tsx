import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../api/index.js';
import type { User, Ticket } from '../types.js';
import { TicketCard } from '../components/MasterDashboard/TicketCard.js';
import { CreateTicketModal } from '../components/MasterDashboard/CreateTicketModal.js';

export default function MasterDashboard({ user }: { user: User }) {
  const [statusFilter, setStatusFilter] = useState<'new' | 'in_work'>('new');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const cleanCompanyId = Array.isArray(user.companyId) 
        ? user.companyId[0] 
        : user.companyId;

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['myTickets', statusFilter],
    queryFn: () => {
      return ticketsApi.getMyTickets({ 
        companyId: cleanCompanyId, 
        masterId: Number(user.id), 
        status: statusFilter 
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: ticketsApi.acceptByMaster,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myTickets'] }),
  });

  const completeMutation = useMutation({
    mutationFn: ticketsApi.completeByMaster,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myTickets'] }),
  });

  if (isLoading) return <div className="text-center p-4 text-gray-500 font-medium">Загрузка заявок...</div>;

  return (
    <div className="max-w-md mx-auto w-full pb-8">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">Мои заявки</h2>
      
      {/* ПЕРЕКЛЮЧАТЕЛЬ СТАТУСОВ */}
      <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <button 
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
            statusFilter === 'new' 
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          onClick={() => setStatusFilter('new')}
        >
          Новые
        </button>
        <button 
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
            statusFilter === 'in_work' 
              ? 'bg-white dark:bg-gray-700 text-yellow-600 dark:text-yellow-500 shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          onClick={() => setStatusFilter('in_work')}
        >
          В работе
        </button>
      </div>

      {/* СПИСОК ЗАЯВОК */}
      <div className="space-y-4">
        {tickets?.map((ticket: Ticket) => (
          <TicketCard 
            key={ticket.id} 
            ticket={ticket}
            onAccept={(id) => acceptMutation.mutate({ ticketId: id, masterId: Number(user.id) })}
            onComplete={(id) => completeMutation.mutate({ ticketId: id, masterId: Number(user.id) })}
          />
        ))}

        {/* ПУСТОЕ СОСТОЯНИЕ */}
        {tickets?.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 border-dashed">
            <span className="text-4xl block mb-3">☕</span>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {statusFilter === 'new' ? 'Новых заявок пока нет' : 'Нет заявок в работе'}
            </p>
          </div>
        )}
      </div>
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 md:absolute md:bottom-0 md:right-0 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center text-3xl font-light transition-transform active:scale-90 z-40"
        aria-label="Добавить фото"
      >
        +
      </button>

      {/* МОДАЛЬНОЕ ОКНО */}
      <CreateTicketModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        companyId={cleanCompanyId} 
      />
    </div>
  );
}