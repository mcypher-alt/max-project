import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import formatPhone from '../helper/formatPhone.js';
import prisma from '../lib/prisma.js'; 
import bcrypt from 'bcrypt';

const router = Router();

// Настройка лимитера для СМС
const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 3, // Максимум 3 запроса с одного IP за указанное окно (15 мин)
  message: { error: 'Слишком много попыток запроса кода. Пожалуйста, подождите 15 минут.' },
  standardHeaders: true, // Возвращает информацию о лимите в заголовках `RateLimit-*`
  legacyHeaders: false, // Отключает старые заголовки `X-RateLimit-*`
});


router.post('/forgot-password', smsLimiter, async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone: rawPhone } = req.body;
    if (!rawPhone) return res.status(400).json({ error: 'Укажите номер телефона' });

    const phone = formatPhone(rawPhone); // Убедись, что формат '79XXXXXXXXX'
    const user = await prisma.user.findUnique({ where: { phone } });

    // --- Интеграция с SMS Aero ---
    const SMSAERO_LOGIN = process.env.SMSAERO_LOGIN;
    const SMSAERO_API_KEY = process.env.SMSAERO_API_KEY;
    const SMSAERO_SIGN = process.env.SMSAERO_SIGN || 'SMS Aero'; // Или твоя подтвержденная подпись из ЛК
    const CALLBACK_URL = process.env.SMSAERO_CALLBACK_URL || 'https://example.com/callback'

    const authHeader = 'Basic ' + Buffer.from(`${SMSAERO_LOGIN}:${SMSAERO_API_KEY}`).toString('base64');

    const aeroResponse = await fetch('https://gate.smsaero.ru/v2/mobile-id/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        number: phone,
        sign: SMSAERO_SIGN,
        callbackUrl: CALLBACK_URL
      })
    });

    const aeroData = await aeroResponse.json();

    if (!aeroData.success) {
      console.error('Ошибка SMS Aero:', aeroData);
      return res.status(500).json({ error: 'Не удалось отправить запрос на подтверждение' });
    }

    // Берем ID сессии от SMS Aero (он нам нужен для роута /verify)
    const sessionId = String(aeroData.data.id); 
    
    // Даем пользователю 5 минут на ввод кода
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); 

    // Сохраняем ID сессии в SQLite. 
    // Я использую твое текущее поле `code` для хранения этого ID.
    await prisma.passwordReset.upsert({
      where: { phone },
      update: { code: sessionId, expiresAt },
      create: { phone, code: sessionId, expiresAt },
    });

    console.log(`\n[SMS AERO] Ушел PUSH/SMS на ${phone}, Session ID: ${sessionId}\n`);
    
    return res.json({ 
      message: 'Запрос на подтверждение отправлен.',
      sessionId: sessionId // <- Обязательно отдаем ID фронтенду!
    });

  } catch (error) {
    console.error('Ошибка при восстановлении пароля:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// 2. Подтверждение и сброс пароля (сюда жесткий лимит можно не ставить, либо сделать отдельный на 10-20 попыток ввода)
router.post('/reset-password', async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone: rawPhone, code, newPassword } = req.body;

    if (!rawPhone || !newPassword) {
      return res.status(400).json({ error: 'Переданы не все данные' });
    }

    const phone = formatPhone(rawPhone);
    const resetRecord = await prisma.passwordReset.findUnique({ where: { phone } });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Сессия сброса не найдена или истекла' });
    }

    if (new Date() > resetRecord.expiresAt) {
      await prisma.passwordReset.delete({ where: { phone } });
      return res.status(400).json({ error: 'Время действия истекло' });
    }

    // ---------------------------------------------------------
    // ЧЕК 1: Если SIM-PUSH уже подтвердился через Callback
    // ---------------------------------------------------------
    const isPushApproved = resetRecord.code.startsWith('APPROVED_');

    if (!isPushApproved) {
      // ---------------------------------------------------------
      // ЧЕК 2: Если PUSH не был подтвержден, проверяем SMS-код
      // ---------------------------------------------------------
      if (!code) {
        return res.status(400).json({ error: 'Введите SMS-код' });
      }

      const sessionId = parseInt(resetRecord.code, 10);
      const SMSAERO_LOGIN = process.env.SMSAERO_LOGIN;
      const SMSAERO_API_KEY = process.env.SMSAERO_API_KEY;
      const SMSAERO_SIGN = process.env.SMSAERO_SIGN || 'SMS Aero';
      const authHeader = 'Basic ' + Buffer.from(`${SMSAERO_LOGIN}:${SMSAERO_API_KEY}`).toString('base64');

      const aeroResponse = await fetch('https://gate.smsaero.ru/v2/mobile-id/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          id: sessionId,
          sign: SMSAERO_SIGN,
          code: String(code)
        })
      });

      if (aeroResponse.status === 400) {
        return res.status(400).json({ error: 'Неверный код из SMS' });
      }
      if (!aeroResponse.ok) {
        return res.status(500).json({ error: 'Ошибка проверки кода провайдером' });
      }

      const aeroData = await aeroResponse.json();
      if (!aeroData.success) {
        return res.status(400).json({ error: 'Не удалось подтвердить код' });
      }
    }

    // Если всё ок (либо PUSH подтвержден, либо SMS верный) — обновляем пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { phone },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.delete({
        where: { phone },
      }),
    ]);

    return res.json({ message: 'Пароль успешно изменен' });

  } catch (error) {
    console.error('Ошибка при сбросе пароля:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении пароля' });
  }
});

export default router;