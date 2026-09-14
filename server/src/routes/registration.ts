import { Router} from 'express';
import type { Request, Response } from 'express';
import formatPhone from '../helper/formatPhone.js';
import prisma from '../lib/prisma.js'; 
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<any> => {
    const token = req.query.token as string;
    if (!token) {
        return res.status(400).json({ error: 'Токен не передан' });
    }

    try {
        const invite = await prisma.validToken.findUnique({
        where: { token }
        });

        // Если токена нет, он уже использован или протух по времени
        if (!invite || invite.isUsed || new Date() > invite.expiresAt) {
        return res.status(400).json({ 
            error: 'Ссылка недействительна, уже была использована или её срок истек' 
        });
        }

        // Возвращаем фронту метаданные, чтобы он знал, под какую роль подстраивать интерфейс
        return res.json({
        role: invite.role,
        companyId: invite.companyId
        });
    } catch (error) {
        console.error('Ошибка при проверке инвайт-токена:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
    });

router.post('/generate', requireAuth(['dispatcher', 'admin']), async (req: Request, res: Response): Promise<any> => {
    const { role, companyId, phone } = req.body;

    if (!role || !companyId || !phone) {
        return res.status(400).json({ error: 'Не указана роль сотрудника, ID компании или телефон' });
    }

    if (role !== 'dispatcher' && role !== 'master') {
        return res.status(400).json({
            error: 'Разрешено генерировать ссылки только для линейного персонала: dispatcher, master' 
        });
    }

    let cleanPhone = formatPhone(phone); // Если всё ок, сохраняем очищенный номер

    try {
        const token = crypto.randomUUID(); 
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); 

        // Сохраняем токен в таблицу valid_tokens
        await prisma.validToken.create({
            data: {
                token,
                role,
                companyId,
                expiresAt,
                phone: cleanPhone
            }
        });

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const inviteUrl = `${clientUrl}/?token=${token}`;

        const encodedEmail = encodeURIComponent(process.env.SMSAERO_LOGIN || '');
        const encodedApiKey = encodeURIComponent(process.env.SMSAERO_API_KEY || '');
        const encodedText = encodeURIComponent(inviteUrl);
        const encodedSign = encodeURIComponent(process.env.SMSAERO_SIGN || 'SMS Aero');

        const url = `https://${encodedEmail}:${encodedApiKey}@gate.smsaero.ru/v2/sms/send?number=${cleanPhone}&text=${encodedText}&sign=${encodedSign}`;

        const aeroResponse = await fetch(url);
        const aeroData = await aeroResponse.json();

        if (!aeroData.success) {
        console.error('Ошибка SMS Aero:', aeroData);
        throw new Error(aeroData.message || 'Не удалось отправить СМС');
        }

        return res.json({
            success: true,
            inviteUrl,
            expiresAt
        });
    } catch (error) {
        console.error('Ошибка при генерации инвайт-токена:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при создании приглашения' });
    }
});

    /**
     * 2. POST /api/auth/registration
     * Финальный этап: создание сотрудника в БД и деактивация токена
     */
router.post('/', async (req: Request, res: Response): Promise<any> => {
    const { token, password, name } = req.body;

    if (!token) {
    return res.status(400).json({ error: 'Отсутствует токен приглашения. Доступ запрещен.' });
    }

    if (!password || !name) {
    return res.status(400).json({ error: 'Пожалуйста, заполните все поля формы: Имя, Логин и Пароль' });
    }

    try {
        const invite = await prisma.validToken.findUnique({
        where: { token }
        });

        if (!invite || invite.isUsed || new Date() > invite.expiresAt) {
        return res.status(400).json({ error: 'Токен безопасности невалиден' });
        }

        const cleanPhone = formatPhone(invite.phone);

        if (!cleanPhone) {
            return res.status(400).json({ error: 'В данном приглашении не указан номер телефона' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);

        // Запускаем транзакцию: если что-то упадет (например, логин уже занят), 
        // то ни юзер не создастся, ни токен не сгорит. Всё или ничего.
        await prisma.$transaction([
        // Создаем сотрудника
        prisma.user.upsert({
            where: { phone: cleanPhone }, // Ищем по телефону
            update: {
                password: hashedPassword,   // Если нашли — просто обновляем пароль на новый
                name,
                role: invite.role,
                companyId: invite.companyId
            },
            create: {
                phone: cleanPhone,          // Если не нашли — создаем нового сотрудника
                password: hashedPassword,
                name,
                role: invite.role,
                companyId: invite.companyId
            }
        }),
        // Помечаем инвайт-ссылку как отработанную
        prisma.validToken.update({
            where: { token },
            data: { isUsed: true }
        })
        ]);

        return res.json({ success: true, message: 'Сотрудник успешно добавлен в систему!' });
    } catch (error: any) {
        console.error('Ошибка при регистрации сотрудника:', error);
        
        // Перехватываем уникальный индекс Prisma (если логин уже существует в БД)
        if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Пользователь с таким логином уже зарегистрирован' });
        }
        
        return res.status(500).json({ error: 'Не удалось завершить регистрацию' });
    }
});

export default router;