import React, { useState } from 'react';
import { toast } from 'sonner'; 
import { passwordApi } from '../api/index.js'; 

interface Props {
  onBackToLogin: () => void;
}

export default function ResetPasswordScreen({ onBackToLogin }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error('Введите номер телефона');
      return;
    }

    setIsLoading(true);
    setCode('');
    setNewPassword('');

    try {
      const res = await passwordApi.forgotPassword(phone);
      toast.success(res.message || 'СМС с кодом отправлено!');
      setStep(2);
    } catch (err: any) {
      const message =
        err.response?.data?.error ||
        err.data?.error ||
        err.error || 
        (typeof err === 'string' ? err : null) || 
        err.message || 
        'Ошибка при отправке запроса';

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code) {
      toast.error('Введите код из СМС');
      return;
    }
    
    if (!newPassword) {
      toast.error('Введите новый пароль');
      return;
    }

    setIsLoading(true);
    try {
      await passwordApi.resetPassword({ phone, code, newPassword });
      toast.success('Пароль успешно изменен!');
      onBackToLogin();
    } catch (err: any) {
      const message =
        err.response?.data?.error ||
        err.data?.error ||
        err.error ||
        (typeof err === 'string' ? err : null) || 
        err.message ||
        'Ошибка при отправке запроса';
    
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-blue-600">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-center">
          Восстановление пароля
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
          {step === 1 
            ? 'Введите номер, чтобы получить СМС с кодом подтверждения' 
            : 'Введите код из СМС и придумайте новый пароль'}
        </p>

        {step === 1 ? (
          <form onSubmit={handleSendCode} noValidate className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Номер телефона
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+79XXXXXXXXX"
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-blue-400 flex justify-center items-center"
            >
              {isLoading ? 'Отправка...' : 'Получить код'}
            </button>
            
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium transition-colors"
            >
              Вспомнили пароль? Войти
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} noValidate className="space-y-5">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Код из СМС
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Например: 1234"
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Новый пароль
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-blue-400 flex justify-center items-center"
            >
              {isLoading ? 'Сохранение...' : 'Сохранить новый пароль'}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium transition-colors"
            >
              Вернуться назад
            </button>
          </form>
        )}
      </div>
    </div>
  );
}