import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { ticketsApi, dictApi, authApi } from '../api/index.js';
import type { User, Ticket } from '../types.js';
import { AddHouseModal, CreateTicketModal, InviteEmployeeModal } from '../components/modals';
import { ActionButton, Select } from '../components/ui/index.js';
import { StatusBadge, EmergencyTimer, MasterCell } from '../components/dashboard';

export default function DispatcherDashboard({ user }: { user: User }) {
  const [filters, setFilters] = useState({
    companyId: 'all', 
    masterId: '',
    status: '',
    type: ''
  });

const [inviteError, setInviteError] = useState<string | null>(null);

  // ПАГИНАЦИЯ
  const [currentPage, setCurrentPage] = useState(1);
  const TICKETS_PER_PAGE = 10;

  // Сброс страницы при смене фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const queryClient = useQueryClient();
  const userCompanies = (() => {
    if (!user?.companyId) return [];
    return Array.isArray(user.companyId) ? user.companyId : [user.companyId];
  })();

  // Грузим заявки
  const { data: rawTicketsData, isLoading: isTicketsLoading } = useQuery({
    queryKey: ['tickets', filters, user.companyId],
    queryFn: async () => {
      if (filters.companyId === 'all') {
        const requests = userCompanies.map(id => ticketsApi.getTickets({ ...filters, companyId: id, masterId: undefined }));
        const responses = await Promise.all(requests);
        return responses.flatMap(res => Array.isArray(res) ? res : ((res as any)?.tickets || (res as any)?.data || []));
      } else {
        const res = await ticketsApi.getTickets(filters);
        return Array.isArray(res) ? res : ((res as any)?.tickets || (res as any)?.data || []);
      }
    },
    enabled: userCompanies.length > 0, 
  });

  // Грузим мастеров ТОЛЬКО для фильтра в шапке (если выбрана конкретная УК)
  const { data: headerMasters = [] } = useQuery({
    queryKey: ['header_masters', filters.companyId],
    queryFn: async () => {
      if (filters.companyId === 'all') return [];
      const res = await dictApi.getMasters(filters.companyId);
      return Array.isArray(res) ? res : ((res as any)?.users || (res as any)?.data || []);
    },
    enabled: filters.companyId !== 'all',
  });

  const closeMutation = useMutation({
    mutationFn: (ticketId: number) => ticketsApi.closeByDispatcher({ ticketId, userId: Number(user.id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    onError: (err: any) => {
    const message = err.response?.data?.error || err.response?.data?.message || 'Ошибка при закрытии заявки';
    toast.error(message);
  }
  });

  // Подготовка данных для пагинации
  const tickets: Ticket[] = rawTicketsData || [];
  const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE);
  const paginatedTickets = tickets.slice(
    (currentPage - 1) * TICKETS_PER_PAGE,
    currentPage * TICKETS_PER_PAGE
  );

  // ===============================================
  // СТЕЙТЫ И МУТАЦИИ ДЛЯ СОЗДАНИЯ СОТРУДНИКА
  // ===============================================
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    companyId: userCompanies[0] || '', // Сброшен хардкод
    role: user.role === 'admin' ? 'dispatcher' : 'master',
    phone: ''
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const generateInviteMutation = useMutation({
  mutationFn: (data: { role: string; companyId: string; phone: string }) => authApi.generateInvite({
    role: data.role,
    companyId: data.companyId,
    phone: data.phone.trim() ? data.phone.trim() : undefined
  }),
  onSuccess: (res: any) => {
    setGeneratedLink(res.inviteUrl);
    setInviteError(null);
    // СТРОКУ setIsCopied(false) МЫ УДАЛИЛИ ОТСЮДА (она теперь живет внутри модалки)
  },
  onError: (err: any) => {
    setInviteError(err.response?.data?.error || err.response?.data?.message || 'Не удалось сгенерировать инвайт');
    setGeneratedLink(null);
    // СТРОКУ setIsCopied(false) МЫ УДАЛИЛИ ОТСЮДА
  }
  });

  // ===============================================
  // СТЕЙТЫ И МУТАЦИЯ ДЛЯ ДОБАВЛЕНИЯ ДОМА
  // ===============================================
  const [isAddHouseOpen, setIsAddHouseOpen] = useState(false);

  const createHouseMutation = useMutation({
    mutationFn: async (data: { companyId: string; address: string }) => {
      return await dictApi.postHouses({
        companyId: data.companyId,
        address: data.address.trim(),
      });
    },
    onSuccess: () => {
    toast.success('Дом успешно добавлен в базу!');
    setIsAddHouseOpen(false);
    // СТРОКУ setHouseForm(...) МЫ УДАЛИЛИ ОТСЮДА
    queryClient.invalidateQueries({ queryKey: ['houses'] });
    },
    onError: (err: any) => {
      console.error('Ошибка добавления дома:', err);
      const message = err.response?.data?.error || err.response?.data?.message || 'Ошибка при добавлении дома';
      toast.error(message);
    }
  });

  // ===============================================
  // СТЕЙТЫ И МУТАЦИЯ ДЛЯ ЗАЯВОК
  // ===============================================
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);

  const createTicketMutation = useMutation({
    mutationFn: (data: { companyId: string; address: string; description: string; isEmergency: boolean }) => ticketsApi.create({
      companyId: data.companyId,
      address: data.address.trim(),
      description: data.description.trim(),
      type: data.isEmergency ? 'emergency' : 'regular' 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsCreateTicketOpen(false);
    },
    onError: (err: any) => {
      const message = err.response?.data?.error || err.response?.data?.message || 'Не удалось создать заявку';
      toast.error(message);
    }
  });

  const [ticketIdToConfirm, setTicketIdToConfirm] = useState<number | null>(null);

  return (
    <div className="w-full h-full flex flex-col p-6 max-w-[1600px] mx-auto text-gray-900 dark:text-white transition-colors">
      <div className="flex justify-between items-end mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-750">
        <div>
          <h2 className="text-2xl font-bold">Панель диспетчера</h2>
        </div>
        
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-red-600 dark:text-red-500 font-bold cursor-pointer select-none px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <input 
              type="checkbox" 
              checked={filters.type === 'emergency'}
              onChange={(e) => setFilters(p => ({ ...p, type: e.target.checked ? 'emergency' : '' }))}
              className="w-4 h-4 accent-red-600 dark:accent-red-500 cursor-pointer"
            />
            Экстренные
          </label>

          {/* Фильтр по компании */}
          <Select
            value={filters.companyId}
            onChange={(e) => setFilters((p) => ({ ...p, companyId: e.target.value, masterId: '' }))}
          >
            <option value="all">Все компании</option>
            {userCompanies.map((id) => (
              <option key={id} value={id}>
                {id === 'crocus' ? 'АО Крокус' : id === 'meridian' ? 'Меридиан' : id}
              </option>
            ))}
          </Select>

          {/* Фильтр по мастеру */}
          <Select
            disabled={filters.companyId === 'all'}
            value={filters.masterId}
            onChange={(e) => setFilters((p) => ({ ...p, masterId: e.target.value }))}
          >
            <option value="">Все мастера</option>
            {headerMasters.map((m: User) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>

          {/* Фильтр по статусу */}
          <Select
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">Все статусы</option>
            <option value="new">Новое</option>
            <option value="in_work">В процессе</option>
            <option value="completed">Завершен</option>
          </Select>

          <ActionButton variant="gray" onClick={() => setIsAddHouseOpen(true)}>
            + Добавить дом
          </ActionButton>

          <ActionButton variant="emerald" onClick={() => setIsCreateTicketOpen(true)}>
            + Новая заявка
          </ActionButton>

          <ActionButton variant="blue" onClick={() => setIsInviteModalOpen(true)}>
            Создать сотрудника
          </ActionButton>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-750 overflow-hidden flex flex-col transition-colors">
        {isTicketsLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Загрузка...</div>
        ) : tickets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Заявок не найдено</div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 font-semibold sticky top-0 z-10 transition-colors">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Адрес</th>
                    <th className="px-6 py-4">Проблема</th>
                    <th className="px-6 py-4">Статус</th>
                    <th className="px-6 py-4">Мастер</th>
                    <th className="px-6 py-4">Создана</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
                  {paginatedTickets.map(ticket => (
                    <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                        {ticket.id}
                        <div className="text-xs text-gray-400 font-normal mt-0.5">{ticket.companyId}</div>
                      </td>
                      <td className="px-6 py-4 font-medium">{ticket.address}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {ticket.type === 'emergency' ? (
                          <div className="flex flex-col gap-1">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 w-max">
                              Экстренная
                            </span>
                            {ticket.status !== 'completed' && (
                              <EmergencyTimer createdAt={ticket.createdAt} />
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Обычная
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="px-6 py-4">
                        <MasterCell ticket={ticket} />
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 text-right">
                      {ticket.status !== 'completed' && (
                        ticketIdToConfirm === ticket.id ? (
                          <div 
                            className="flex flex-col items-end gap-2 opacity-100 transition-all w-32 ml-auto"
                            onMouseLeave={() => setTicketIdToConfirm(null)}
                            >
                            <button
                              onClick={() => {
                                closeMutation.mutate(ticket.id);
                                setTicketIdToConfirm(null);
                              }}
                              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors shadow-sm text-center"
                            >
                              Да, закрыть
                            </button>
                            <button
                              onClick={() => setTicketIdToConfirm(null)}
                              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium text-sm px-4 py-2 rounded-lg transition-colors text-center"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setTicketIdToConfirm(ticket.id)}
                            className="text-gray-400 hover:text-red-600 font-medium text-base transition-colors px-6 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100"
                          >
                            Закрыть
                          </button>
                        )
                      )}
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 mt-auto">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Страница <span className="font-bold text-gray-900 dark:text-white">{currentPage}</span> из {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Вперед
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. СОЗДАНИЕ СОТРУДНИКА */}
      <InviteEmployeeModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setGeneratedLink(null);
          setInviteError(null);
        }}
        user={{ ...user }}
        userCompanies={userCompanies}
        onSubmit={(formData) => generateInviteMutation.mutate(formData)}
        isPending={generateInviteMutation.isPending}
        generatedLink={generatedLink}
        inviteError={inviteError}
      />

      {/* 2. ДОБАВЛЕНИЕ ДОМА */}
      <AddHouseModal
        isOpen={isAddHouseOpen}
        onClose={() => setIsAddHouseOpen(false)}
        userCompanies={userCompanies}
        onSubmit={(formData) => createHouseMutation.mutate(formData)}
        isPending={createHouseMutation.isPending}
      />

      {/* 3. СОЗДАНИЕ ЗАЯВКИ */}
      <CreateTicketModal
        isOpen={isCreateTicketOpen}
        onClose={() => setIsCreateTicketOpen(false)}
        userCompanies={userCompanies}
        onSubmit={(formData) => createTicketMutation.mutate(formData)}
        isPending={createTicketMutation.isPending}
      />
    </div>
  );
}