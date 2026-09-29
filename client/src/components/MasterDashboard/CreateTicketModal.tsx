import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, dictApi } from '../../api/index.js';
import { PhotoUploader } from '../common/PhotoUploader.js';
import { COMPANY_NAMES } from '../common/consts.js';
import type { Ticket } from '../../types.js';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string | number;
  userCompanies?: string[];
  houses?: any[];
  onSubmit?: (formData: {
    companyId: string;
    address: string;
    description: string;
    isEmergency: boolean;
    photos?: string[];
  }) => void;
  isPending?: boolean;
}

export function CreateTicketModal({
  isOpen,
  onClose,
  companyId,
  userCompanies = [],
  houses: initialHouses,
  onSubmit,
  isPending: externalIsPending,
}: CreateTicketModalProps) {
  // Список доступных компаний (берем либо одиночный ID, либо массив компаний диспетчера)
  const availableCompanies = companyId
    ? [String(companyId)]
    : userCompanies.length > 0
    ? userCompanies
    : [];

  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Ticket['type']>('regular');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const queryClient = useQueryClient();

  // При открытии инициализируем выбранную компанию и сбрасываем поля
  useEffect(() => {
    if (isOpen) {
      if (companyId) {
        setSelectedCompany(String(companyId));
      } else if (userCompanies.length > 0) {
        setSelectedCompany(userCompanies[0]);
      }
    } else {
      setAddress('');
      setDescription('');
      setType('regular');
      setPhotoUrls([]);
    }
  }, [isOpen, companyId, userCompanies]);

  // Загружаем дома для выбранной компании с безопасной распаковкой массива
  const { data: fetchedHouses = [], isLoading: isHousesLoading } = useQuery({
    queryKey: ['houses', selectedCompany],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const res = await dictApi.getHouses(selectedCompany);
      return Array.isArray(res) ? res : (res as any)?.houses || (res as any)?.data || [];
    },
    enabled: isOpen && Boolean(selectedCompany) && !initialHouses?.length,
  });

  const houses = initialHouses?.length ? initialHouses : fetchedHouses;

  // Фолбэк-мутация мастера (если модалка используется без кастомного onSubmit)
  const internalMutation = useMutation({
    mutationFn: (data: Pick<Ticket, 'address' | 'description' | 'type'> & { photos?: string[] }) =>
      ticketsApi.postByMaster(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      onClose();
    },
  });

  const isSubmitting = externalIsPending ?? internalMutation.isPending;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (onSubmit) {
      // Если передана функция из DispatcherDashboard — вызываем её
      onSubmit({
        companyId: selectedCompany,
        address,
        description,
        isEmergency: type === 'emergency',
        photos: photoUrls,
      });
    } else {
      // Иначе работаем как мастер
      internalMutation.mutate({
        address,
        description,
        type,
        photos: photoUrls,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Новая заявка
        </h3>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4">
          
          {/* ВЫБОР КОМПАНИИ (если у диспетчера их несколько) */}
          {availableCompanies.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Управляющая компания
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  setAddress(''); // сбрасываем адрес при смене УК
                }}
                disabled={isSubmitting}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              >
                {availableCompanies.map((cId) => (
                  <option key={cId} value={cId}>
                    {COMPANY_NAMES[cId] || cId}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ПОЛЕ: Адрес */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Адрес дома
            </label>
            <select
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isHousesLoading || isSubmitting}
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 disabled:opacity-70 disabled:cursor-not-allowed text-gray-900 dark:text-white"
            >
              <option value="" disabled>
                {isHousesLoading ? 'Загрузка адресов...' : 'Выберите адрес'}
              </option>
              
              {houses.map((house: any, idx: number) => {
                const houseAddress = typeof house === 'string' ? house : house.address;
                const houseId = typeof house === 'string' ? idx : (house.id || idx);
                
                return (
                  <option key={houseId} value={houseAddress}>
                    {houseAddress}
                  </option>
                );
              })}
            </select>
            {houses.length === 0 && !isHousesLoading && (
              <span className="text-xs text-amber-500 mt-1 block">
                В выбранной УК пока нет добавленных домов
              </span>
            )}
          </div>

          {/* ПОЛЕ: Описание */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Описание проблемы
            </label>
            <textarea 
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 min-h-[100px] text-gray-900 dark:text-white"
              placeholder="Опишите суть проблемы..."
            />
          </div>

          {/* СРОЧНОСТЬ */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Срочность
            </label>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="urgency"
                  className="peer hidden"
                  checked={type === 'regular'}
                  onChange={() => setType('regular')}
                />
                <div className="text-center py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 peer-checked:bg-blue-50 peer-checked:border-blue-500 peer-checked:text-blue-600 dark:peer-checked:bg-blue-900/30 dark:peer-checked:text-blue-300 text-sm font-medium transition-all">
                  Обычная
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="urgency"
                  className="peer hidden"
                  checked={type === 'emergency'}
                  onChange={() => setType('emergency')}
                />
                <div className="text-center py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 peer-checked:bg-red-50 peer-checked:border-red-500 peer-checked:text-red-600 dark:peer-checked:bg-red-900/30 dark:peer-checked:text-red-300 text-sm font-medium transition-all">
                  Экстренная
                </div>
              </label>
            </div>
          </div>

          {/* ЗАГРУЗКА ФОТО */}
          <div className="pt-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Фотографии
            </label>
            <PhotoUploader 
              onUrlsChange={setPhotoUrls} 
              onUploadingChange={setIsUploadingPhotos}
              maxFiles={5}
            />
          </div>
          
          {/* КНОПКИ */}
          <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isUploadingPhotos || isSubmitting || !address || !selectedCompany}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:dark:bg-gray-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Создание...' : isUploadingPhotos ? 'Грузим фото...' : 'Создать'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}