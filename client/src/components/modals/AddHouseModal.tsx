import { useState, FormEvent } from 'react';
import { toast } from 'sonner';

export interface HouseFormData {
  companyId: string;
  address: string;
}

export interface AddHouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCompanies?: string[];
  onSubmit: (data: HouseFormData) => void;
  isPending?: boolean;
}

export function AddHouseModal({
  isOpen,
  onClose,
  userCompanies = [],
  onSubmit,
  isPending = false,
}: AddHouseModalProps) {
  const [houseForm, setHouseForm] = useState<HouseFormData>({
    companyId: userCompanies[0] || '',
    address: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!houseForm.companyId) {
      toast.error('Выберите управляющую компанию!');
      return;
    }

    if (!houseForm.address.trim()) {
      toast.error('Введите адрес дома!');
      return;
    }

    onSubmit(houseForm);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-6 text-gray-900 dark:text-white relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg font-bold transition-colors"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold mb-1">Добавление нового дома</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Зарегистрировать новый адрес в базе Управляющей Компании
        </p>

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Управляющая компания
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none"
              value={houseForm.companyId}
              onChange={(e) => setHouseForm((p) => ({ ...p, companyId: e.target.value }))}
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
            <input
              type="text"
              placeholder="Например: ул. Ленина, д. 10"
              className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              value={houseForm.address}
              onChange={(e) => setHouseForm((p) => ({ ...p, address: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-50 shadow-md flex justify-center items-center gap-2"
          >
            {isPending ? 'Добавление...' : 'Добавить адрес'}
          </button>
        </form>
      </div>
    </div>
  );
}