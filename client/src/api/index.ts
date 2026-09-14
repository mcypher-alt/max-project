import axios from 'axios';
import type { Ticket, User, House } from '../types.js';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export const authApi = {
  login: async (data: any) => (await api.post('/login', data)).data,
  register: async (data: any) => (await api.post('/registration', data)).data,
  generateInvite: async (data: any) => (await api.post('/registration/generate', data)).data,
  getMe: async () => (await api.get('/login/me')).data,
  logout: async () => (await api.post('/login/logout')).data,
};

export const ticketsApi = {
  // Достаем массив из ключа .tickets или .data, если бэк отдал объект
  getTickets: async (params: any) => {
    // Спорный момент: убедись, что тут правильный эндпоинт для заявок диспетчера, например '/tickets'
    const res = (await api.get('/tickets', { params })).data; 
    if (Array.isArray(res)) return res;
    return res?.tickets || res?.data || [];
  },

  getMyTickets: async (params: any) => {
    const res = (await api.get('/tickets/my', { params })).data;
    if (Array.isArray(res)) return res;
    return res?.tickets || res?.data || [];
  },

  create: async (data: any) => (await api.post('/tickets', data)).data,
  
  closeByDispatcher: async (data: { ticketId: number; userId: number }) => 
    (await api.post('/tickets/dispatcher/close', data)).data,
    
  assignMaster: async (data: { ticketId: number; masterId: number }) => 
    (await api.post('/tickets/assign', data)).data,

  // ИСПРАВЛЕНО: Возвращаем методы, которые заждался MasterDashboard
  acceptByMaster: async (data: { ticketId: number; masterId: number }) => 
    (await api.post('/tickets/master/accept', data)).data,

  completeByMaster: async (data: { ticketId: number; masterId: number }) => 
    (await api.post('/tickets/master/complete', data)).data,
  postByMaster: async (data: {
  address: string;
  description: string;
  type: Ticket['type'];
  photos?: string[];
    }) => {
      return (await api.post('/tickets/by-master', data)).data;
    },
};

export const dictApi = {
  getHouses: async (companyId: string) => {
    const res = (await api.get('/houses', { params: { companyId } })).data;
    
    if (Array.isArray(res)) return res;
    
    return res?.addresses || res?.houses || res?.data || [];
  },
  postHouses: async (data: { address: string; companyId: string }) => {
  const { data: responseData } = await api.post('/houses', data);
  
  // Бэкенд возвращает { house: ... }, берем его. Если что-то пошло не так, возвращаем весь объект
  return responseData?.house || responseData;
},

  // ИСПРАВЛЕНО: Теперь эта функция ВСЕГДА возвращает чистый массив, 
  // вытаскивая его из твоего ключа { masters: [...] }
  getMasters: async (companyId: string) => {
    const res = (await api.get('/users/masters', { params: { companyId } })).data;
    if (Array.isArray(res)) return res;
    return res?.masters || res?.users || res?.data || [];
  },
};

const cleanPhone = (phone: string): string => phone.replace(/\D/g, '');

export const passwordApi = {
  // 1. Запрос кода подтверждения (MOCK SMS)
  forgotPassword: async (phone: string) => {
    const res = await api.post('/password/forgot-password', {
      phone: cleanPhone(phone),
    });
    return res.data;
  },

  // 2. Сброс пароля (передаем очищенный телефон, код и новый пароль)
  resetPassword: async (data: { phone: string; code: string; newPassword: string }) => {
    const res = await api.post('/password/reset-password', {
      phone: cleanPhone(data.phone),
      code: data.code,
      newPassword: data.newPassword,
    });
    return res.data;
  },
};

export const mobileApi = {
  checkStatus: async (sessionId: string) => {
    const res = await axios.get(`/api/password/check-status/${sessionId}`);
    return res.data;
  },
  // Эндпоинт для SMS Aero (добавлено по твоей просьбе, но в проде фронт его не вызывает)
  aeroCallback: async (data: { id: number; status: number }) => {
    const res = await axios.post('/api/password/mobile-id/callback', data);
    return res.data;
  }
}

export const uploadApi = {
  uploadPhoto: async (
    file: File, 
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await axios.post<{ url: string }>('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });

    return response.data.url;
  },
};