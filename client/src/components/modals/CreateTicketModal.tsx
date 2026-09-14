import { useState, FormEvent, useEffect } from 'react';
import { toast } from 'sonner';

export interface TicketFormData {
  companyId: string;
  address: string;
  description: string;
  isEmergency: boolean;
}

export interface HouseItem {
  id?: string | number;
  address?: string;
}

export interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCompanies?: string[];
  houses?: (HouseItem | string)[];
  isHousesLoading?: boolean;
  onCompanyChange?: (companyId: string) => void;
  onSubmit: (formData: TicketFormData) => void;
  isPending?: boolean;
}

export function CreateTicketModal({
  isOpen,
  onClose,
  userCompanies = [],
  houses = [],
  isHousesLoading = false,
  onCompanyChange,
  onSubmit,
  isPending = false,
}: CreateTicketModalProps) {
  const [ticketForm, setTicketForm] = useState<TicketFormData>({
    companyId: userCompanies[0] || '',
    address: '',
    description: '',
    isEmergency: false,
  });

  // При первом открытии синхронизируем выбранную компанию
  useEffect(() => {
    if (isOpen && userCompanies[0] && !ticketForm.companyId) {
      setTicketForm((p) => ({ ...p, companyId: userCompanies[0] }));
      onCompanyChange?.(userCompanies[0]);
    }
  }, [isOpen, userCompanies, ticketForm.companyId, onCompanyChange]);

  if (!isOpen) return null;

  const handleCompanySelect = (newCompanyId: string) => {
    setTicketForm((p) => ({ ...p, companyId: newCompanyId, address: '' }));
    onCompanyChange?.(newCompanyId);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!ticketForm.address) {
      toast.error('Выберите адрес!');
      return;
    }

    if (!ticketForm.description.trim()) {
      toast.error('Заполните описание проблемы!');
      return;
    }

    onSubmit(ticketForm);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-white relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold mb-1">Создание новой заявки</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Зарегистрировать новую проблему жильца в системе
        </p>

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Управляющая компания
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none"
              value={ticketForm.companyId}
              onChange={(e) => handleCompanySelect(e.target.value)}
            >
              {userCompanies.length === 0 && (
                <option value="" disabled>
                  Загрузка...
                </option>
              )}
              {userCompanies.map((id) => (
                <option key={id} value={id}>
                  {id === 'crocus' ? 'АО Крокус' : id === 'meridian' ? 'Меридиан' : id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Адрес дома
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none disabled:opacity-50"
              value={ticketForm.address}
              onChange={(e) => setTicketForm((p) => ({ ...p, address: e.target.value }))}
              disabled={isHousesLoading}
              required
            >
              <option value="" disabled>
                {isHousesLoading ? 'Загрузка списка домов...' : 'Выберите адрес из списка...'}
              </option>
              {houses.map((house, index) => {
                const houseAddress = typeof house === 'string' ? house : house.address || '';
                return (
                  <option key={index} value={houseAddress}>
                    {houseAddress}
                  </option>
                );
              })}
            </select>

            {!isHousesLoading && houses.length === 0 && (
              <p className="text-[11px] text-red-500 mt-1 font-medium">
                У этой УК пока нет зарегистрированных домов в базе данных
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Описание проблемы
            </label>
            <textarea
              placeholder="Прорвало трубу в ванной, топит соседей..."
              value={ticketForm.description}
              onChange={(e) => setTicketForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none resize-none h-24"
              required
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-3 cursor-pointer select-none text-red-600 dark:text-red-400 font-bold text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
              <input
                type="checkbox"
                checked={ticketForm.isEmergency}
                onChange={(e) => setTicketForm((p) => ({ ...p, isEmergency: e.target.checked }))}
                className="w-5 h-5 accent-red-600 cursor-pointer"
              />
              Выставить статус: ЭКСТРЕННО (30 минут)
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending || isHousesLoading}
            className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-50 shadow-md"
          >
            {isPending ? 'Создание заявки...' : 'Зарегистрировать заявку'}
          </button>
        </form>
      </div>
    </div>
  );
}