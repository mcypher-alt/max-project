import { useMemo } from 'react';

declare global {
    interface Window {
        WebApp?: {
            initData?: string;
            initDataUnsafe?: {
                user?: {
                    id: number | string;
                    first_name?: string;
                    last_name?: string;
                    username?: string;
                    phone?: string;
                };
            };
            ready?: () => void;
            expand?: () => void;
            close?: () => void;
        };
    }
}

export function useMaxUser() {
    return useMemo(() => {
        const webApp = typeof window !== 'undefined' ? window.WebApp : undefined;
        const realUser = webApp?.initDataUnsafe?.user;

        if (realUser) {
            webApp?.ready?.();
            webApp?.expand?.();

            const fullName = [realUser.first_name, realUser.last_name]
                .filter(Boolean)
                .join(' ') || realUser.username || 'Житель';

            return {
                maxUserId: String(realUser.id),
                name: fullName,
                phone: realUser.phone,
                isMock: false
            };
        }

        // Фоллбек для отладки на localhost
        return {
            maxUserId: 'test_resident_101',
            name: 'Никита (Тест)',
            phone: '+79991234567',
            isMock: true
        };
    }, []);
}