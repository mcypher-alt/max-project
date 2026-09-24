import axios from 'axios';
import https from 'https';

const MAX_API_URL = 'https://platform-api2.max.ru';
const BOT_TOKEN = process.env.MAX_BOT_TOKEN;

// Агент для игнорирования проблем с российскими сертификатами на хакатоне
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

const maxClient = axios.create({
    baseURL: MAX_API_URL,
    headers: {
        'Authorization': BOT_TOKEN,
        'Content-Type': 'application/json'
    },
    httpsAgent
});

/**
 * Проверка валидности токена бота
 */
export async function checkBotAuth() {
    try {
        const response = await maxClient.get('/me');
        console.log('Бот успешно авторизован:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('Ошибка авторизации бота в МАХ:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Отправка текстового уведомления жителю по chatId / maxUserId
 */
export async function sendNotificationToResident(chatId: string | number, text: string) {
    if (!BOT_TOKEN) {
        console.warn('MAX_BOT_TOKEN не задан в .env, уведомление пропущено');
        return;
    }

    try {
        const response = await maxClient.post('/messages', {
            chat_id: chatId, // либо user_id / recipient в зависимости от структуры тела
            text: text
        });
        return response.data;
    } catch (error: any) {
        console.error('Ошибка отправки уведомления в МАХ:', error.response?.data || error.message);
    }
}