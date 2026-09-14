import { Router } from 'express';
import type { Request, Response }  from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

router.post('/', async (req: Request, res: Response): Promise<any> => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Введите номер телефона и пароль' });
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
        cleanPhone = '7' + cleanPhone.slice(1);
    }

    try {
        const user = await prisma.user.findUnique({
        where: { phone: cleanPhone }
        });

        if (!user) {
        return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
        return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
        }

        const companies = (user.role === 'admin' || user.role === 'dispatcher')
        ? ['crocus', 'meridian'] // Список всех твоих УК
        : [user.companyId];

        const token = jwt.sign(
        {
            id: user.id,
            name: user.name,
            role: user.role,
            companyId: user.companyId
        },
        JWT_SECRET,
        { expiresIn: '7d' } // Токен автоматически протухнет через 7 дней
        );

        res.cookie('token', token, {
            httpOnly: true, // Защита от XSS (JS не увидит куку)
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней в ms
        });

        return res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            role: user.role,
            companyId: companies
        }
        });
    } catch (error) {
        console.error('Ошибка при авторизации:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.post('/logout', (req: Request, res: Response): any => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    return res.json({ success: true });
});

router.get('/me', (req: Request, res: Response): any => {
    // Cookie-parser автоматически кладет куки в req.cookies
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ authenticated: false });
    }

    try {
        // Расшифровываем JWT
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: number;
            name: string;
            role: string;
            companyId: string | string[];
        };

        // Логика расширения прав для диспетчера и админа
        let userCompanies: string | string[] = decoded.companyId;

        if (decoded.role === 'dispatcher' || decoded.role === 'admin') {
            // Для диспетчеров и админов отдаем полный список УК
            userCompanies = ['crocus', 'meridian'];
        }

        return res.json({ 
            authenticated: true, 
            user: {
                ...decoded,
                companyId: userCompanies
            }
        });
    } catch (error) {
        // Если токен подделан или истек срок — стираем куку
        res.clearCookie('token');
        return res.status(401).json({ authenticated: false, error: 'Сессия истекла' });
    }
});

export default router;