import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PhotoIcon, XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';
import { ticketsApi, dictApi, authApi } from '../api/index.js';
import type { User, Ticket } from '../types.js';
import { AddHouseModal, CreateTicketModal, InviteEmployeeModal } from '../components/modals';
import { ActionButton, Select } from '../components/ui/index.js';
import { StatusBadge, EmergencyTimer, MasterCell } from '../components/dashboard';
import { COMPANY_NAMES } from '../components/common/consts.js';

// Парсер описания и сборщик всех фотографий заявки
const extractTicketData = (ticket: Ticket | null) => {
  if (!ticket) return { cleanText: '', photos: [] };

  const rawText = ticket.description || '';
  const photoMatches = Array.from(rawText.matchAll(/\[PHOTO\]:(https?:\/\/[^\s]+)/g)).map(
    (m) => m[1]
  );

  const cleanText = rawText
    .replace(/\n\n\[PHOTO\]:(https?:\/\/[^\s]+)/g, '')
    .replace(/\[PHOTO\]:(https?:\/\/[^\s]+)/g, '')
    .trim();

  // Достаем фото из массива relation (если бэк присылает photos: [{ url }])
  const relationPhotos = Array.isArray((ticket as any).photos)
    ? (ticket as any).photos.map((p: any) => (typeof p === 'string' ? p : p.url))
    : [];

  const allPhotos = Array.from(new Set([...relationPhotos, ...photoMatches])).filter(Boolean);

  return {
    cleanText: cleanText || 'Без описания',
    photos: allPhotos,
  };
};

export default function DispatcherDashboard({ user }: { user: User }) {
  const [filters, setFilters] = useState({
    companyId: 'all',
    masterId: '',
    status: '',
    type: '',
  });

  const [inviteError, setInviteError] = useState<string | null>(null);

  // Стейты для детального просмотра заявки и зума фото
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  // ПАГИНАЦИЯ
  const [currentPage, setCurrentPage] = useState(1);
  const TICKETS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const queryClient = useQueryClient();
  const userCompanies = (() => {
    if (!user?.companyId) return [];
    return Array.isArray(user.companyId) ? user.companyId : [user.companyId];
  })();

  // Загрузка заявок
  const { data: rawTicketsData, isLoading: isTicketsLoading } = useQuery({
    queryKey: ['tickets', filters, user.companyId],
    queryFn: async () => {
      if (filters.companyId === 'all') {
        const requests = userCompanies.map((id) =>
          ticketsApi.getTickets({ ...filters, companyId: id, masterId: undefined })
        );
        const responses = await Promise.all(requests);
        return responses.flatMap((res) =>
          Array.isArray(res) ? res : (res as any)?.tickets || (res as any)?.data || []
        );
      } else {
        const res = await ticketsApi.getTickets(filters);
        return Array.isArray(res) ? res : (res as any)?.tickets || (res as any)?.data || [];
      }
    },
    enabled: userCompanies.length > 0,
  });

  // Загрузка мастеров для селекта
  const { data: headerMasters = [] } = useQuery({
    queryKey: ['header_masters', filters.companyId],
    queryFn: async () => {
      if (filters.companyId === 'all') return [];
      const res = await dictApi.getMasters(filters.companyId);
      return Array.isArray(res) ? res : (res as any)?.users || (res as any)?.data || [];
    },
    enabled: filters.companyId !== 'all',
  });

  const closeMutation = useMutation({
    mutationFn: (ticketId: number) =>
      ticketsApi.closeByDispatcher({ ticketId, userId: Number(user.id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (selectedTicket) setSelectedTicket(null);
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.error || err.response?.data?.message || 'Ошибка при закрытии заявки';
      toast.error(message);
    },
  });

  const tickets: Ticket[] = rawTicketsData || [];
  const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE);
  const paginatedTickets = tickets.slice(
    (currentPage - 1) * TICKETS_PER_PAGE,
    currentPage * TICKETS_PER_PAGE
  );

  // Инвайты
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const generateInviteMutation = useMutation({
    mutationFn: (data: { role: string; companyId: string; phone: string }) =>
      authApi.generateInvite({
        role: data.role,
        companyId: data.companyId,
        phone: data.phone.trim() ? data.phone.trim() : undefined,
      }),
    onSuccess: (res: any) => {
      setGeneratedLink(res.inviteUrl);
      setInviteError(null);
    },
    onError: (err: any) => {
      setInviteError(
        err.response?.data?.error || err.response?.data?.message || 'Не удалось сгенерировать инвайт'
      );
      setGeneratedLink(null);
    },
  });

  // Добавление дома
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
      queryClient.invalidateQueries({ queryKey: ['houses'] });
    },
    onError: (err: any) => {
      console.error('Ошибка добавления дома:', err);
      const message =
        err.response?.data?.error || err.response?.data?.message || 'Ошибка при добавлении дома';
      toast.error(message);
    },
  });

  // Создание заявки диспетчером
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const createTicketMutation = useMutation({
    mutationFn: (data: {
      companyId: string;
      address: string;
      description: string;
      isEmergency: boolean;
    }) =>
      ticketsApi.create({
        companyId: data.companyId,
        address: data.address.trim(),
        description: data.description.trim(),
        type: data.isEmergency ? 'emergency' : 'regular',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsCreateTicketOpen(false);
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.error || err.response?.data?.message || 'Не удалось создать заявку';
      toast.error(message);
    },
  });

  const [ticketIdToConfirm, setTicketIdToConfirm] = useState<number | null>(null);

  // Детали выбранной для просмотра заявки
  const activeTicketDetails = extractTicketData(selectedTicket);

  return (
    <div className="w-full h-full flex flex-col p-6 max-w-[1600px] mx-auto text-gray-900 dark:text-white transition-colors">
      
      {/* ФИЛЬТРЫ И ДЕЙСТВИЯ */}
      <div className="flex justify-between items-end mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold">Панель диспетчера</h2>
        </div>

        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-red-600 dark:text-red-500 font-bold cursor-pointer select-none px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <input
              type="checkbox"
              checked={filters.type === 'emergency'}
              onChange={(e) =>
                setFilters((p) => ({ ...p, type: e.target.checked ? 'emergency' : '' }))
              }
              className="w-4 h-4 accent-red-600 dark:accent-red-500 cursor-pointer"
            />
            Экстренные
          </label>

          <Select
            value={filters.companyId}
            onChange={(e) =>
              setFilters((p) => ({ ...p, companyId: e.target.value, masterId: '' }))
            }
          >
            <option value="all">Все компании</option>
            {userCompanies.map((id) => (
              <option key={id} value={id}>
                {COMPANY_NAMES[id] || id}
              </option>
            ))}
          </Select>

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

      {/* ТАБЛИЦА */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col transition-colors">
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
                    <th className="px-6 py-4 w-24">ID</th>
                    <th className="px-6 py-4 w-64">Адрес</th>
                    <th className="px-6 py-4 min-w-[320px] max-w-md">Проблема</th>
                    <th className="px-6 py-4 w-36">Статус</th>
                    <th className="px-6 py-4 w-48">Мастер</th>
                    <th className="px-6 py-4 w-32">Создана</th>
                    <th className="px-6 py-4 text-right w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
                  {paginatedTickets.map((ticket) => {
                    const { cleanText, photos } = extractTicketData(ticket);

                    return (
                      <tr
                        key={ticket.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                      >
                        {/* ID и Компания */}
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white align-top">
                          #{ticket.id}
                          <div className="text-xs text-gray-400 font-normal mt-0.5">
                            {ticket.companyId}
                          </div>
                        </td>

                        {/* Адрес */}
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100 align-top whitespace-normal">
                          <div>{ticket.address}</div>
                          {ticket.apartment && (
                            <div className="text-xs text-gray-400">кв. {ticket.apartment}</div>
                          )}
                        </td>

                        {/* Проблема + превью модалки */}
                        <td className="px-6 py-4 align-top max-w-md">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {ticket.type === 'emergency' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                                  Экстренная
                                </span>
                                {ticket.status !== 'completed' && (
                                  <EmergencyTimer createdAt={ticket.createdAt} />
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                Обычная
                              </span>
                            )}

                            {/* Бейдж количества фото */}
                            {photos.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedTicket(ticket)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 transition-colors cursor-pointer"
                              >
                                <PhotoIcon className="w-3.5 h-3.5" />
                                {photos.length > 1 ? `${photos.length} фото` : 'Фото'}
                              </button>
                            )}
                          </div>

                          {/* Кликабельный текст проблемы */}
                          <div
                            onClick={() => setSelectedTicket(ticket)}
                            className="cursor-pointer group/desc"
                            title="Нажмите, чтобы открыть подробности"
                          >
                            <p className="whitespace-normal break-words line-clamp-2 text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug group-hover/desc:text-blue-600 dark:group-hover/desc:text-blue-400 transition-colors">
                              {cleanText}
                            </p>
                            <span className="text-[11px] text-gray-400 group-hover/desc:text-blue-500 font-normal inline-flex items-center gap-1 mt-0.5">
                              <EyeIcon className="w-3 h-3" /> подробнее
                            </span>
                          </div>
                        </td>

                        {/* Статус */}
                        <td className="px-6 py-4 align-top">
                          <StatusBadge status={ticket.status} />
                        </td>

                        {/* Мастер */}
                        <td className="px-6 py-4 align-top">
                          <MasterCell ticket={ticket} />
                        </td>

                        {/* Дата создания */}
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs align-top pt-5">
                          {new Date(ticket.createdAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        {/* Действие закрытия */}
                        <td className="px-6 py-4 text-right align-top">
                          {ticket.status !== 'completed' &&
                            (ticketIdToConfirm === ticket.id ? (
                              <div
                                className="flex flex-col items-end gap-1.5 opacity-100 transition-all w-28 ml-auto"
                                onMouseLeave={() => setTicketIdToConfirm(null)}
                              >
                                <button
                                  onClick={() => {
                                    closeMutation.mutate(ticket.id);
                                    setTicketIdToConfirm(null);
                                  }}
                                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium text-xs py-1.5 rounded-lg transition-colors shadow-xs text-center"
                                >
                                  Закрыть
                                </button>
                                <button
                                  onClick={() => setTicketIdToConfirm(null)}
                                  className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium text-xs py-1.5 rounded-lg transition-colors text-center"
                                >
                                  Отмена
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setTicketIdToConfirm(ticket.id)}
                                className="text-gray-400 hover:text-red-600 font-medium text-xs transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100"
                              >
                                Закрыть
                              </button>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ПАГИНАЦИЯ */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 mt-auto">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Страница <span className="font-bold text-gray-900 dark:text-white">{currentPage}</span> из{' '}
                  {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      {/* ======================================================== */}
      {/* МОДАЛКА: ПРОСМОТР ОПИСАНИЯ И ФОТОГРАФИЙ ЗАЯВКИ          */}
      {/* ======================================================== */}
      {selectedTicket && (
        <div
          onClick={() => setSelectedTicket(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-5 cursor-default max-h-[90vh] overflow-y-auto"
          >
            {/* ШАПКА МОДАЛКИ */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    Заявка #{selectedTicket.id}
                  </span>
                  <StatusBadge status={selectedTicket.status} />
                  {selectedTicket.type === 'emergency' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                      Экстренная
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  Создана:{' '}
                  {new Date(selectedTicket.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* КАРТОЧКА АДРЕСА И ИНФОРМАЦИИ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-gray-750 text-xs">
              <div>
                <span className="text-gray-400 block mb-0.5">Адрес</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {selectedTicket.address}
                  {selectedTicket.apartment ? `, кв. ${selectedTicket.apartment}` : ''}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">Компания</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {COMPANY_NAMES[selectedTicket.companyId] || selectedTicket.companyId}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">Назначенный мастер</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {(selectedTicket as any).master?.name || 'Не назначен'}
                </span>
              </div>
            </div>

            {/* СУТЬ ПРОБЛЕМЫ */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Описание проблемы
              </h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-750">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {activeTicketDetails.cleanText}
                </p>
              </div>
            </div>

            {/* ГАЛЕРЕЯ ФОТОГРАФИЙ */}
            {activeTicketDetails.photos.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <PhotoIcon className="w-4 h-4" />
                  Прикрепленные фото ({activeTicketDetails.photos.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {activeTicketDetails.photos.map((url, idx) => (
                    <div
                      key={idx}
                      onClick={() => setZoomedPhoto(url)}
                      className="group relative h-36 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 cursor-pointer shadow-xs"
                    >
                      <img
                        src={url}
                        alt={`Фото ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                        <EyeIcon className="w-4 h-4" /> Увеличить
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* НИЖНЯЯ ПАНЕЛЬ ДЕЙСТВИЙ */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              {selectedTicket.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => closeMutation.mutate(selectedTicket.id)}
                  disabled={closeMutation.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors"
                >
                  {closeMutation.isPending ? 'Закрытие...' : 'Закрыть заявку'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium text-xs rounded-xl transition-colors"
              >
                Закрыть окно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ЛАЙТБОКС: ПОЛНОРАЗМЕРНЫЙ ПРОСМОТР КАРТИНКИ               */}
      {/* ======================================================== */}
      {zoomedPhoto && (
        <div
          onClick={() => setZoomedPhoto(null)}
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-100"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={zoomedPhoto}
              alt="Увеличенное фото"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* ОСТАЛЬНЫЕ МОДАЛКИ */}
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

      <AddHouseModal
        isOpen={isAddHouseOpen}
        onClose={() => setIsAddHouseOpen(false)}
        userCompanies={userCompanies}
        onSubmit={(formData) => createHouseMutation.mutate(formData)}
        isPending={createHouseMutation.isPending}
      />

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