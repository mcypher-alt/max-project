import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import formatPhone from '../helper/formatPhone.js';
import prisma from '../lib/prisma.js'; 
import bcrypt from 'bcrypt';

const router = Router();

// Лимитер запросов (для демо-режима увеличен, чтобы не блокировать тесты жюри)
const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, 
  message: { error: 'Слишком много попыток запроса кода. Пожалуйста, подождите.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 1. Запрос на восстановление пароля (МОК)
router.post('/forgot-password', smsLimiter, async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone: rawPhone } = req.body;
    if (!rawPhone) return res.status(400).json({ error: 'Укажите номер телефона' });

    const phone = formatPhone(rawPhone);
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь с таким номером телефона не найден' });
    }

    // Тестовый код и сессия
    const mockCode = '1111';
    const sessionId = `mock-session-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут на ввод

    // Сохраняем код в БД
    await prisma.passwordReset.upsert({
      where: { phone },
      update: { code: mockCode, expiresAt },
      create: { phone, code: mockCode, expiresAt },
    });

    // Логируем в терминал бэкенда для наглядности
    console.log('\n=========================================');
    console.log(`[MOCK SMS SERVICE] Запрос кода для: ${phone}`);
    console.log(`[MOCK SMS SERVICE] Проверочный код: ${mockCode}`);
    console.log('=========================================\n');
    
    return res.json({ 
      message: 'Код подтверждения отправлен (Тестовый режим: 1111)',
      sessionId: sessionId 
    });

  } catch (error) {
    console.error('Ошибка при восстановлении пароля:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// 2. Подтверждение и сброс пароля (МОК)
router.post('/reset-password', async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone: rawPhone, code, newPassword } = req.body;

    if (!rawPhone || !newPassword || !code) {
      return res.status(400).json({ error: 'Переданы не все данные' });
    }

    const phone = formatPhone(rawPhone);
    const resetRecord = await prisma.passwordReset.findUnique({ where: { phone } });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Сессия сброса не найдена или истекла' });
    }

    if (new Date() > resetRecord.expiresAt) {
      await prisma.passwordReset.delete({ where: { phone } });
      return res.status(400).json({ error: 'Время действия кода истекло' });
    }

    // Проверяем введенный код
    const incomingCode = String(code).trim();
    if (incomingCode !== resetRecord.code && incomingCode !== '1111') {
      return res.status(400).json({ error: 'Неверный проверочный код' });
    }

    // Хешируем новый пароль и обновляем пользователя в транзакции
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