import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, dictApi } from '../../api/index.js'; // Не забудь импортировать dictApi
import { PhotoUploader } from '../common/PhotoUploader.js';
import type { Ticket } from '../../types.js';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | number; // Теперь модалка просит companyId для запроса адресов
}

export function CreateTicketModal({ isOpen, onClose, companyId }: CreateTicketModalProps) {
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Ticket['type']>('regular');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const queryClient = useQueryClient();

  // 1. ЗАГРУЖАЕМ СПИСОК ДОМОВ
  const { data: houses = [], isLoading: isHousesLoading } = useQuery({
    queryKey: ['houses', companyId],
    queryFn: () => dictApi.getHouses(String(companyId)),
    enabled: isOpen, // Запрос улетит только когда модалка откроется
  });

  // Очистка формы при закрытии
  useEffect(() => {
    if (!isOpen) {
      setAddress('');
      setDescription('');
      setType('regular');
      setPhotoUrls([]);
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: Pick<Ticket, 'address' | 'description' | 'type'> & { photos?: string[] }) => 
      ticketsApi.postByMaster(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTickets'] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      address,
      description,
      type,
      photos: photoUrls,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Новая заявка
        </h3>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4">
          
          {/* ОБНОВЛЕННОЕ ПОЛЕ: Адрес (Селект) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Адрес</label>
            <select
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isHousesLoading || createMutation.isPending}
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 disabled:opacity-70 disabled:cursor-not-allowed text-gray-900 dark:text-white"
            >
              <option value="" disabled>
                {isHousesLoading ? 'Загрузка адресов...' : 'Выберите адрес'}
              </option>
              
              {/* Рендерим адреса. Проверяем, строка это или объект с полем address */}
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
          </div>

          {/* Поле: Описание */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Описание проблемы</label>
            <textarea 
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 min-h-[100px]"
              placeholder="Прорвало трубу на кухне..."
            />
          </div>

          {/* Переключатель: Тип заявки */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Срочность</label>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <input type="radio" className="peer hidden" checked={type === 'regular'} onChange={() => setType('regular')} />
                <div className="text-center py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 peer-checked:bg-blue-50 peer-checked:border-blue-500 peer-checked:text-blue-600 dark:peer-checked:bg-blue-900/30 text-sm font-medium transition-all">
                  Обычная
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input type="radio" className="peer hidden" checked={type === 'emergency'} onChange={() => setType('emergency')} />
                <div className="text-center py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 peer-checked:bg-red-50 peer-checked:border-red-500 peer-checked:text-red-600 dark:peer-checked:bg-red-900/30 text-sm font-medium transition-all">
                  Экстренная
                </div>
              </label>
            </div>
          </div>

          {/* ИНТЕГРАЦИЯ ФОТО */}
          <div className="pt-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Фотографии</label>
            <PhotoUploader 
              onUrlsChange={setPhotoUrls} 
              onUploadingChange={setIsUploadingPhotos}
              maxFiles={5}
            />
          </div>
          
          {/* Кнопки формы */}
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
              disabled={isUploadingPhotos || createMutation.isPending || !address}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:dark:bg-gray-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center"
            >
              {createMutation.isPending ? 'Создание...' : isUploadingPhotos ? 'Грузим фото...' : 'Создать'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}