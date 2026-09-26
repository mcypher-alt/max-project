import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MaxUI,
  Panel,
  Typography,
  Button,
  Avatar,
} from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import {
  WrenchScrewdriverIcon,
  BoltIcon,
  FireIcon,
  SparklesIcon,
  EllipsisHorizontalCircleIcon,
  PhotoIcon,
  XMarkIcon,
  MapPinIcon,
  PlusIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import {
  residentsApi,
  dictApi,
  ticketsApi,
  uploadApi,
} from '../api/index.js';
import { useMaxUser } from '../hooks/useMaxUser.js';
import type { Ticket, House } from '../types.js';

const CATEGORIES = [
  { id: 'Сантехника', label: 'Сантехника', icon: WrenchScrewdriverIcon },
  { id: 'Электрика', label: 'Электрика', icon: BoltIcon },
  { id: 'Отопление', label: 'Отопление', icon: FireIcon },
  { id: 'Уборка', label: 'Уборка', icon: SparklesIcon },
  { id: 'Другое', label: 'Другое', icon: EllipsisHorizontalCircleIcon },
];

interface ResidentScreenProps {
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export default function ResidentScreen({
  theme = 'light',
  onToggleTheme,
}: ResidentScreenProps) {
  const { maxUserId, name, phone, isMock } = useMaxUser();

  // Состояния экранов и загрузки
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Списки данных
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [houses, setHouses] = useState<House[]>([]);

  // Форма выбора адреса
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedHouseId, setSelectedHouseId] = useState<number | ''>('');
  const [apartment, setApartment] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Форма тикета
  const [selectedCategory, setSelectedCategory] = useState('Сантехника');
  const [ticketDescription, setTicketDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Инициализация профиля
  const initResident = async () => {
    try {
      const res = await residentsApi.sync({ maxUserId, name, phone });
      const residentData = res?.resident || res;
      setProfile(residentData);

      if (residentData?.houseId && residentData?.companyId && residentData?.apartment) {
        await loadTickets();
      } else {
        setShowAddressModal(true);
        loadCompanies();
      }
    } catch (error) {
      console.error('Ошибка инициализации жителя:', error);
      toast.error('Не удалось синхронизировать профиль');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // 2. Получение тикетов
  const loadTickets = async () => {
    try {
      const data = await ticketsApi.getByResident(maxUserId);
      const list = Array.isArray(data) ? data : (data as any)?.tickets || [];
      setTickets(list);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
      toast.error('Ошибка загрузки заявок');
    }
  };

  // 3. Получение справочников
  const loadCompanies = async () => {
    try {
      const data = await dictApi.getCompanies();
      const list = Array.isArray(data) ? data : (data as any)?.companies || [];
      setCompanies(list);
    } catch (error) {
      console.error('Ошибка загрузки УК:', error);
    }
  };

  const handleCompanyChange = (compId: string) => {
    setSelectedCompanyId(compId);
    setSelectedHouseId('');
    const company = companies.find((c) => c.id === compId);
    setHouses(company?.houses || []);
  };

  // 4. Сохранение адреса
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !selectedHouseId || !apartment.trim()) {
      toast.warning('Заполните все поля адреса');
      return;
    }

    try {
      setIsSavingProfile(true);
      const res = await residentsApi.updateProfile({
        maxUserId,
        companyId: selectedCompanyId,
        houseId: Number(selectedHouseId),
        apartment: apartment.trim(),
        name,
        phone,
      });

      const updated = res?.resident || res;
      setProfile(updated);
      setShowAddressModal(false);
      toast.success('Адрес успешно сохранён');
      loadTickets();
    } catch (error) {
      console.error('Ошибка сохранения адреса:', error);
      toast.error('Не удалось сохранить адрес');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 5. Загрузка фото в S3 / MinIO
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Размер фото не более 10 МБ');
      return;
    }

    try {
      setUploadProgress(0);
      const url = await uploadApi.uploadPhoto(file, (percent) => {
        setUploadProgress(percent);
      });
      setPhotoUrl(url);
      toast.success('Фото прикреплено');
    } catch (error) {
      console.error('Ошибка загрузки фото:', error);
      toast.error('Не удалось загрузить фото');
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. Создание обращения
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDescription.trim()) {
      toast.warning('Опишите суть проблемы');
      return;
    }

    if (!profile?.houseId || !profile?.companyId) {
      toast.error('Сначала выберите адрес проживания');
      setShowAddressModal(true);
      return;
    }

    try {
      setIsSubmittingTicket(true);

      const fullDesc = `[${selectedCategory}] ${ticketDescription.trim()}`;

      await ticketsApi.createByResident({
        maxUserId,
        companyId: profile.companyId,
        address: profile.house?.address, // Бэкенд ищет дом по связке address + companyId
        apartment: profile.apartment || '1',
        description: fullDesc,
        photos: photoUrl ? [photoUrl] : [], // Передаем фото напрямую массивом
      });

      toast.success('Заявка успешно зарегистрирована');
      setTicketDescription('');
      setPhotoUrl(null);
      setShowCreateModal(false);
      setActiveTab('active');
      loadTickets();
    } catch (error) {
      console.error('Ошибка отправки заявки:', error);
      toast.error('Не удалось отправить заявку');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  useEffect(() => {
    initResident();
  }, [maxUserId]);

  const activeTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'new' || t.status === 'in_work');
  }, [tickets]);

  const historyTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'completed');
  }, [tickets]);

  const currentDisplayTickets = activeTab === 'active' ? activeTickets : historyTickets;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <ClockIcon className="w-3.5 h-3.5" /> В очереди
          </span>
        );
      case 'in_work':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <WrenchScrewdriverIcon className="w-3.5 h-3.5" /> В работе
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircleIcon className="w-3.5 h-3.5" /> Выполнена
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {status}
          </span>
        );
    }
  };

  const parseTicketContent = (desc: string) => {
    const photoMatch = desc.match(/\[PHOTO\]:(https?:\/\/[^\s]+)/);
    const cleanText = desc.replace(/\n\n\[PHOTO\]:(https?:\/\/[^\s]+)/, '').trim();
    return {
      text: cleanText,
      photo: photoMatch ? photoMatch[1] : null,
    };
  };

  if (isLoading) {
    return (
      <MaxUI colorScheme={theme}>
        <Panel mode="secondary" className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <Typography.Text className="text-gray-500 font-medium text-sm">Загрузка сервиса...</Typography.Text>
          </div>
        </Panel>
      </MaxUI>
    );
  }

  return (
    <MaxUI colorScheme={theme}>
      <Panel
        mode="secondary"
        className="w-full max-w-full overflow-x-hidden min-h-[100dvh] bg-gray-50 dark:bg-gray-950 pb-safe text-gray-900 dark:text-gray-100 transition-colors"
      >
        {isMock && (
          <div className="w-full bg-amber-500/15 border-b border-amber-500/20 px-3 py-1 text-center text-[11px] font-medium text-amber-800 dark:text-amber-300">
            Режим отладки (ID: {maxUserId})
          </div>
        )}

        <div className="w-full max-w-md mx-auto px-4 py-3 space-y-3.5 box-border">
          
          {/* КАРТОЧКА ПРОФИЛЯ */}
          <div className="w-full bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Avatar.Container size={42} form="squircle" className="shrink-0 bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                  <Avatar.Image src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80" />
                </Avatar.Container>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold truncate m-0 leading-tight">
                    {profile?.name || name}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1 min-w-0">
                    <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">
                      {profile?.house?.address
                        ? `${profile.house.address}, кв. ${profile.apartment}`
                        : 'Адрес не выбран'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ПАНЕЛЬ ДЕЙСТВИЙ В ШАПКЕ */}
              <div className="flex items-center gap-0.5 shrink-0">
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="p-2 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 active:scale-90 transition-all rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Переключить тему"
                  >
                    {theme === 'light' ? (
                      <MoonIcon className="w-4 h-4 text-gray-500" />
                    ) : (
                      <SunIcon className="w-4 h-4 text-amber-400" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    loadCompanies();
                    setShowAddressModal(true);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 active:scale-90 transition-transform rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Изменить адрес"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRefreshing(true);
                    loadTickets().finally(() => setIsRefreshing(false));
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 active:scale-90 transition-transform rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Обновить"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* КНОПКА ПОДАЧИ ЗАЯВКИ */}
          <Button
            onClick={() => setShowCreateModal(true)}
            iconBefore={<PlusIcon className="w-5 h-5 stroke-[2.5]" />}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-2xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            Подать заявку в УК
          </Button>

          {/* ТАБЫ */}
          <div className="flex w-full bg-gray-200/80 dark:bg-gray-800/90 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Активные
              {activeTickets.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 leading-none">
                  {activeTickets.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              История
              {historyTickets.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 leading-none">
                  {historyTickets.length}
                </span>
              )}
            </button>
          </div>

          {/* СПИСОК ЗАЯВОК */}
          <div className="space-y-2.5 pb-6">
            {currentDisplayTickets.length === 0 ? (
              <div className="w-full bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-6 text-center space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500">
                  <CheckCircleIcon className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {activeTab === 'active' ? 'Нет активных заявок' : 'История пуста'}
                </div>
                <div className="text-[11px] text-gray-400 max-w-[240px] mx-auto leading-relaxed">
                  {activeTab === 'active'
                    ? 'Если в подъезде или квартире что-то вышло из строя — подайте обращение'
                    : 'Здесь сохраняются выполненные заявки'}
                </div>
              </div>
            ) : (
              currentDisplayTickets.map((t) => {
                const parsed = parseTicketContent(t.description);
                return (
                  <div
                    key={t.id}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-3.5 shadow-xs space-y-2.5 box-border"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-400">
                        №{t.id}
                      </span>
                      {renderStatusBadge(t.status)}
                    </div>

                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line break-words">
                      {parsed.text}
                    </p>

                    {parsed.photo && (
                      <div className="w-full h-32 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50">
                        <img
                          src={parsed.photo}
                          alt="Прикрепленное фото"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400">
                      <span>
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Только что'}
                      </span>
                      {(t as any).master && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium truncate max-w-[150px]">
                          Мастер: {(t as any).master.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* ======================================================== */}
        {/* МОДАЛКА: СОЗДАНИЕ НОВОЙ ЗАЯВКИ                            */}
        {/* ======================================================== */}
        {showCreateModal && (
          <div
            onClick={() => setShowCreateModal(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-150 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-[24px] sm:rounded-3xl p-4 sm:p-5 space-y-3.5 cursor-default max-h-[88vh] overflow-y-auto box-border"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto sm:hidden" />

              <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-bold m-0 text-gray-900 dark:text-white">Новое обращение</h2>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Категория
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-[11px] font-medium leading-tight ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500'
                              : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate w-full text-center">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Суть проблемы
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Что и где сломалось..."
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    className="w-full text-[16px] sm:text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none box-border"
                  />
                </div>

                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {photoUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 h-28 group">
                      <img src={photoUrl} alt="Фото" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotoUrl(null)}
                        className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full"
                        title="Удалить"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadProgress !== null}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 active:scale-[0.99]"
                    >
                      <PhotoIcon className="w-4 h-4 text-gray-400" />
                      {uploadProgress !== null ? `Загрузка ${uploadProgress}%` : 'Прикрепить фото'}
                    </button>
                  )}
                </div>

                <Button
                  disabled={isSubmittingTicket || uploadProgress !== null}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-xl text-sm transition-all"
                >
                  {isSubmittingTicket ? 'Отправка...' : 'Отправить обращение'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* МОДАЛКА: ВЫБОР ИЛИ СМЕНА АДРЕСА                           */}
        {/* ======================================================== */}
        {showAddressModal && (
          <div
            onClick={() => {
              if (profile?.houseId) {
                setShowAddressModal(false);
              } else {
                toast.warning('Сначала привяжите адрес');
              }
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-150 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-[24px] sm:rounded-3xl p-4 sm:p-5 space-y-3.5 cursor-default max-h-[88vh] overflow-y-auto box-border"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto sm:hidden" />

              <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-bold m-0 text-gray-900 dark:text-white">Адрес проживания</h2>
                {profile?.houseId && (
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveAddress} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Управляющая компания
                  </label>
                  <select
                    required
                    value={selectedCompanyId}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className="w-full text-[16px] sm:text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                  >
                    <option value="">Выберите компанию...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Дом
                  </label>
                  <select
                    required
                    disabled={!selectedCompanyId}
                    value={selectedHouseId}
                    onChange={(e) => setSelectedHouseId(Number(e.target.value))}
                    className="w-full text-[16px] sm:text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 box-border"
                  >
                    <option value="">
                      {selectedCompanyId ? 'Выберите дом...' : 'Сначала выберите УК'}
                    </option>
                    {houses.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.address}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Квартира
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например, 42"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    className="w-full text-[16px] sm:text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                  />
                </div>

                <Button
                  disabled={isSavingProfile}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-xl text-sm transition-all mt-1"
                >
                  {isSavingProfile ? 'Сохранение...' : 'Подтвердить адрес'}
                </Button>
              </form>
            </div>
          </div>
        )}

      </Panel>
    </MaxUI>
  );
}