import React, { useState } from 'react';
import { authApi } from '../api/index.js';

interface RegisterScreenProps {
  token: string;
  onRegisterSuccess: () => void;
}

export default function RegisterScreen({ token, onRegisterSuccess }: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !password.trim()) {
      setError('Пожалуйста, заполните все поля формы');
      return;
    }

    try {
      setIsLoading(true);
      const data = await authApi.register({ token, password, name });
      
      if (data.success) {
        onRegisterSuccess();
      } else {
        setError(data.error || data.message || 'Не удалось завершить регистрацию');
      }
    } catch (err: any) {
      const serverError = err.response?.data?.error || err.response?.data?.message;
      setError(serverError || 'Ошибка при отправке данных. Проверьте сеть.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
      <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-1">Регистрация в системе</h2>
        <p className="text-sm text-gray-500 text-center mb-6">Создание учетной записи сотрудника</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Ваше имя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Петрович"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors text-base"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Придумайте пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors text-base"
            />
          </div>

          {/* Спорный момент: Токен подмешивается в POST-запрос скрыто из пропсов. 
              Если токен битый или просроченный, ошибку мы узнаем только после отправки формы. 
              В идеале на бэкенде сделать легкий GET `/api/tokens/validate?token=...` 
              и дергать его через useEffect при загрузке страницы, чтобы сразу заблокировать форму, если инвайт невалиден. */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium rounded-xl transition-colors shadow-sm text-base disabled:opacity-50"
          >
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
}