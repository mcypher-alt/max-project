import { useState, FormEvent, MouseEvent } from 'react';

export interface InviteFormData {
  companyId: string;
  role: string;
  phone: string;
}

export interface UserInfo {
  role?: string;
  [key: string]: unknown;
}

export interface InviteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserInfo;
  userCompanies?: string[];
  onSubmit: (formData: InviteFormData) => void;
  isPending?: boolean;
  generatedLink?: string | null;
  inviteError?: string | null;
}

export function InviteEmployeeModal({
  isOpen,
  onClose,
  user,
  userCompanies = [],
  onSubmit,
  isPending = false,
  generatedLink = null,
  inviteError = null,
}: InviteEmployeeModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    companyId: userCompanies[0] || '',
    role: user.role === 'admin' ? 'dispatcher' : 'master',
    phone: '',
  });

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Фолбэк, если буфер заблокирован
      setIsCopied(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(inviteForm);
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

        <h3 className="text-xl font-bold mb-1">Регистрация сотрудника</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Генерация инвайт-ссылки для мастера или диспетчера
        </p>

        {inviteError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg font-medium">
            {inviteError}
          </div>
        )}

        {generatedLink ? (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-xs rounded-lg font-medium">
              Ссылка успешно создана! Скопируйте её и передайте сотруднику:
            </div>
            <textarea
              readOnly
              value={generatedLink}
              onClick={(e: MouseEvent<HTMLTextAreaElement>) => e.currentTarget.select()}
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none select-all font-mono resize-none h-20"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={isCopied}
              className={`w-full py-2.5 font-medium text-sm rounded-xl transition-all duration-200 ${
                isCopied
                  ? 'bg-emerald-700 text-white cursor-default'
                  : 'bg-green-600 hover:bg-green-700 text-white active:scale-[0.99]'
              }`}
            >
              {isCopied ? '✓ Ссылка скопирована!' : 'Скопировать ссылку'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Компания
              </label>
              <select
                className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none"
                value={inviteForm.companyId}
                onChange={(e) => setInviteForm((p) => ({ ...p, companyId: e.target.value }))}
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
                Роль сотрудника
              </label>
              <select
                className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none"
                value={inviteForm.role}
                onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
              >
                {user.role === 'admin' ? (
                  <>
                    <option value="dispatcher">Диспетчер</option>
                    <option value="master">Мастер</option>
                  </>
                ) : (
                  <option value="master">Мастер</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Телефон сотрудника
              </label>
              <input
                type="tel"
                placeholder="79991234567"
                value={inviteForm.phone}
                onChange={(e) => setInviteForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              {isPending ? 'Генерация...' : 'Отправить приглашение'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}