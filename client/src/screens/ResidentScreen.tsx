import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MaxUI,
  Panel,
  Container,
  Flex,
  Grid,
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

// Категории обращений для быстрого выбора
const CATEGORIES = [
  { id: 'Сантехника', label: 'Сантехника', icon: WrenchScrewdriverIcon },
  { id: 'Электрика', label: 'Электрика', icon: BoltIcon },
  { id: 'Отопление', label: 'Отопление', icon: FireIcon },
  { id: 'Уборка', label: 'Уборка', icon: SparklesIcon },
  { id: 'Другое', label: 'Другое', icon: EllipsisHorizontalCircleIcon },
];

export default function ResidentScreen() {
  const { maxUserId, name, phone, isMock } = useMaxUser();

  // Состояния экрана
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Данные
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [houses, setHouses] = useState<House[]>([]);

  // Форма выбора адреса
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedHouseId, setSelectedHouseId] = useState<number | ''>('');
  const [apartment, setApartment] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Форма заявки
  const [selectedCategory, setSelectedCategory] = useState('Сантехника');
  const [ticketDescription, setTicketDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Инициализация и синхронизация профиля жителя
  const initResident = async () => {
    try {
      const res = await residentsApi.sync({ maxUserId, name, phone });
      const residentData = res?.resident || res;
      setProfile(residentData);

      // Если адрес уже привязан — грузим заявки, иначе открываем окно адреса
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

  // 2. Загрузка обращений
  const loadTickets = async () => {
    try {
      const data = await ticketsApi.getByResident(maxUserId);
      const list = Array.isArray(data) ? data : (data as any)?.tickets || [];
      setTickets(list);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
      toast.error('Ошибка загрузки списка заявок');
    }
  };

  // 3. Загрузка компаний и домов
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
      toast.success('Адрес успешно сохранён!');
      loadTickets();
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      toast.error('Не удалось сохранить адрес');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 5. Загрузка фотографии через S3 / MinIO
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Размер фото не должен превышать 10 МБ');
      return;
    }

    try {
      setUploadProgress(0);
      const url = await uploadApi.uploadPhoto(file, (percent) => {
        setUploadProgress(percent);
      });
      setPhotoUrl(url);
      toast.success('Фото успешно прикреплено');
    } catch (error) {
      console.error('Ошибка загрузки фото:', error);
      toast.error('Ошибка при загрузке фото');
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. Отправка новой заявки
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDescription.trim()) {
      toast.warning('Пожалуйста, опишите проблему');
      return;
    }

    if (!profile?.houseId || !profile?.companyId) {
      toast.error('Сначала укажите адрес проживания');
      setShowAddressModal(true);
      return;
    }

    try {
      setIsSubmittingTicket(true);

      // Формируем текст описания вместе с категорией и ссылкой на фото (если прикреплено)
      let fullDesc = `[${selectedCategory}] ${ticketDescription.trim()}`;
      if (photoUrl) {
        fullDesc += `\n\nФото проблемы: ${photoUrl}`;
      }

      await ticketsApi.createByResident({
        maxUserId,
        companyId: profile.companyId,
        houseId: Number(profile.houseId),
        apartment: profile.apartment || '1',
        description: fullDesc,
      });

      toast.success('Заявка успешно зарегистрирована!');
      setTicketDescription('');
      setPhotoUrl(null);
      setShowCreateModal(false);
      setActiveTab('active');
      loadTickets();
    } catch (error) {
      console.error('Ошибка создания заявки:', error);
      toast.error('Не удалось отправить заявку');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  useEffect(() => {
    initResident();
  }, [maxUserId]);

  // Фильтрация заявок по вкладкам
  const activeTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'new' || t.status === 'in_work');
  }, [tickets]);

  const historyTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'completed');
  }, [tickets]);

  const currentDisplayTickets = activeTab === 'active' ? activeTickets : historyTickets;

  // Форматирование бейджа статуса
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <ClockIcon className="w-3.5 h-3.5" /> В очереди
          </span>
        );
      case 'in_work':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            <WrenchScrewdriverIcon className="w-3.5 h-3.5" /> В работе
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
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

  if (isLoading) {
    return (
      <MaxUI>
        <Panel mode="secondary" className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <Typography.Text className="text-gray-500 font-medium">Загрузка сервиса...</Typography.Text>
          </div>
        </Panel>
      </MaxUI>
    );
  }

  return (
    <MaxUI>
      <Panel mode="secondary" className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 text-gray-900 dark:text-gray-100 transition-colors">
        
        {/* Тестовый баннер (скрывается в реальном мессенджере) */}
        {isMock && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
            Режим отладки (ID: {maxUserId})
          </div>
        )}

        <div className="max-w-md mx-auto p-4 space-y-4">
          
          {/* КАРТОЧКА ПРОФИЛЯ ЖИТЕЛЯ */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar.Container size={44} form="squircle" className="shrink-0 bg-blue-100 dark:bg-blue-900/50 text-blue-600">
                  <Avatar.Image src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80" />
                </Avatar.Container>
                <div className="min-w-0">
                  <Typography.Title className="text-base font-bold truncate m-0">
                    {profile?.name || name}
                  </Typography.Title>
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">
                      {profile?.house?.address
                        ? `${profile.house.address}, кв. ${profile.apartment}`
                        : 'Адрес не выбран'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    loadCompanies();
                    setShowAddressModal(true);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 active:scale-95 transition-all rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Изменить адрес"
                >
                  <PencilSquareIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setIsRefreshing(true);
                    loadTickets().finally(() => setIsRefreshing(false));
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 active:scale-95 transition-all rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Обновить"
                >
                  <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* ГЛАВНАЯ КНОПКА: ПОДАТЬ ОБРАЩЕНИЕ */}
          <Button
            onClick={() => setShowCreateModal(true)}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <PlusIcon className="w-5 h-5 stroke-[2.5]" />
            Подать заявку в УК
          </Button>

          {/* ТАБЫ: АКТИВНЫЕ / ИСТОРИЯ */}
          <div className="flex bg-gray-200/70 dark:bg-gray-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Активные
              {activeTickets.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  {activeTickets.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              История
              {historyTickets.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {historyTickets.length}
                </span>
              )}
            </button>
          </div>

          {/* СПИСОК ЗАЯВОК */}
          <div className="space-y-3">
            {currentDisplayTickets.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-500">
                  <CheckCircleIcon className="w-6 h-6" />
                </div>
                <Typography.Title className="text-sm font-semibold m-0">
                  {activeTab === 'active' ? 'Нет активных заявок' : 'История пуста'}
                </Typography.Title>
                <Typography.Text className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto block">
                  {activeTab === 'active'
                    ? 'Если в подъезде или квартире что-то сломалось — просто нажмите кнопку выше'
                    : 'Здесь будут отображаться решённые и закрытые обращения'}
                </Typography.Text>
              </div>
            ) : (
              currentDisplayTickets.map((t) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-400">
                      №{t.id}
                    </span>
                    {renderStatusBadge(t.status)}
                  </div>

                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                    {t.description}
                  </p>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400">
                    <span>
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Только что'}
                    </span>
                    {t.master && (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        Мастер: {t.master.name}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* ======================================================== */}
        {/* МОДАЛКА: СОЗДАНИЕ НОВОЙ ЗАЯВКИ                            */}
        {/* ======================================================== */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <Typography.Title className="text-base font-bold m-0">Новое обращение</Typography.Title>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                
                {/* Категории */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                    Категория
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-medium ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500'
                              : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Описание проблемы */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                    Суть проблемы
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Опишите, что именно вышло из строя..."
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    className="w-full text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  />
                </div>

                {/* Загрузка фото */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {photoUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-48 group">
                      <img src={photoUrl} alt="Загруженное фото" className="w-full h-44 object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotoUrl(null)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
                        title="Удалить фото"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadProgress !== null}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 transition-all active:scale-[0.99]"
                    >
                      <PhotoIcon className="w-5 h-5 text-gray-400" />
                      {uploadProgress !== null ? `Загрузка... ${uploadProgress}%` : 'Прикрепить фотографию'}
                    </button>
                  )}
                </div>

                {/* Кнопка отправки */}
                <Button
                  disabled={isSubmittingTicket || uploadProgress !== null}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-500/20"
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
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
              
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <Typography.Title className="text-base font-bold m-0">Адрес проживания</Typography.Title>
                {profile?.houseId && (
                  <button
                    onClick={() => setShowAddressModal(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveAddress} className="space-y-3.5">
                
                {/* Селект УК */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Управляющая компания
                  </label>
                  <select
                    required
                    value={selectedCompanyId}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className="w-full text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите компанию...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Селект дома */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Дом
                  </label>
                  <select
                    required
                    disabled={!selectedCompanyId}
                    value={selectedHouseId}
                    onChange={(e) => setSelectedHouseId(Number(e.target.value))}
                    className="w-full text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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

                {/* Квартира */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Квартира
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например, 42"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    className="w-full text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <Button
                  disabled={isSavingProfile}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-500/20 mt-2"
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