import React, { useState, useEffect } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from './types.ts';
import LoginScreen from './screens/LoginScreen.js';
import RegisterScreen from './screens/RegisterScreen.js';
import DispatcherDashboard from './screens/DispatcherDashboard.js';
import MasterDashboard from './screens/MasterDashboard.js';
import ResetPasswordScreen from './screens/ResetPasswordScreen.js';
import ResidentScreen from './screens/ResidentScreen.js';
import { authApi } from './api/index.js';

const queryClient = new QueryClient();

const getInviteParams = () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    return { token };
};

const isResidentEnvironment = () => {
    const params = new URLSearchParams(window.location.search);
    return (
        params.get('mode') === 'resident' ||
        window.location.pathname.startsWith('/resident') ||
        Boolean((window as any).WebApp?.initDataUnsafe?.user)
    );
};

export default function App() {
    // 1. ТЕМА И ОПРЕДЕЛЕНИЕ СРЕДЫ (всегда на самом верху, ДО любых return)
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme') as 'light' | 'dark';
        if (saved) return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    const isResident = isResidentEnvironment();

    // 2. СИНХРОНИЗАЦИЯ ТЕМЫ ДЛЯ ВСЕХ ЭКРАНОВ
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    // 3. ЕСЛИ ЭТО ЖИТЕЛЬ ИЗ МАКСА — ОТДАЕМ МИНИ-АПП С ГОТОВОЙ ТЕМОЙ И УВЕДОМЛЕНИЯМИ
    if (isResident) {
        return (
            <>
                <Toaster position="top-right" richColors />
                <ResidentScreen theme={theme} onToggleTheme={toggleTheme} />
            </>
        );
    }

    // === ДАЛЕЕ ЛОГИКА СОТРУДНИКОВ (ДИСПЕТЧЕРЫ И МАСТЕРА) ===
    const [user, setUser] = useState<User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [inviteParams] = useState(() => getInviteParams());
    const [isRegistering, setIsRegistering] = useState(!!inviteParams.token);
    const [showForgotPassword, setShowForgotPassword] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const response = await authApi.getMe();
                if (response.authenticated) {
                    setUser(response.user);
                }
            } catch (error) {
                setUser(null);
            } finally {
                setIsAuthLoading(false);
            }
        };
        checkSession();
    }, []);

    const handleLogin = (loggedUser: User) => {
        setUser(loggedUser);
    };

    const handleLogout = async () => {
        try {
            await authApi.logout();
            queryClient.clear();
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        } finally {
            setUser(null);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                <div className="text-xl font-medium animate-pulse">Загрузка...</div>
            </div>
        );
    }

    // Роутинг без авторизации
    if (!user) {
        if (isRegistering && inviteParams.token) {
            return (
                <RegisterScreen 
                    token={inviteParams.token} 
                    onRegisterSuccess={() => {
                        setIsRegistering(false);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }}
                />
            );
        }

        if (showForgotPassword) {
            return <ResetPasswordScreen onBackToLogin={() => setShowForgotPassword(false)} />;
        }

        return (
            <LoginScreen 
                onLogin={handleLogin} 
                onForgotPassword={() => {
                    setIsRegistering(false);
                    setShowForgotPassword(true);
                }}
            />
        );
    }

    // Рабочее место сотрудника
    return (
        <QueryClientProvider client={queryClient}>
            <Toaster position="top-right" richColors />
            <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
                <header className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800">
                    <h1 className="text-xl font-bold">
                        Здравствуйте, {user.name}
                    </h1>
                    
                    <div className="flex gap-4 items-center">
                        <button 
                            onClick={toggleTheme}
                            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-lg hover:scale-105 active:scale-95 transition-all"
                            title="Переключить тему"
                        >
                            {theme === 'light' ? (
                                <MoonIcon style={{ width: 24, height: 24 }} />
                            ) : (
                                <SunIcon style={{ width: 24, height: 24 }} />
                            )}
                        </button>
                        
                        <button 
                            onClick={handleLogout} 
                            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium transition-colors hover:bg-red-700"
                        >
                            Выйти
                        </button>
                    </div>
                </header>

                <main className="p-4">
                    {(user.role === 'dispatcher' || user.role === 'admin') && <DispatcherDashboard user={user} />}
                    {user.role === 'master' && <MasterDashboard user={user} />}
                </main>
            </div>
        </QueryClientProvider>
    );
}