import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.post('/sync', async (req: Request, res: Response): Promise<any> => {
    try {
        const { maxUserId, name, phone } = req.body;

        if (!maxUserId) {
            return res.status(400).json({ error: 'Поле maxUserId обязательно' });
        }

        const resident = await prisma.resident.upsert({
            where: { maxUserId: String(maxUserId) },
            update: {
                ...(name ? { name: String(name).trim() } : {}),
                ...(phone ? { phone: String(phone).trim() } : {})
            },
            create: {
                maxUserId: String(maxUserId),
                name: name ? String(name).trim() : undefined,
                phone: phone ? String(phone).trim() : undefined
            },
            include: {
                company: { select: { id: true, name: true } },
                house: { select: { id: true, address: true } }
            }
        });

        return res.json({
            success: true,
            resident,
            isProfileComplete: Boolean(resident.companyId && resident.houseId && resident.apartment)
        });
    } catch (error) {
        console.error('Ошибка синхронизации жителя:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.post('/profile', async (req: Request, res: Response): Promise<any> => {
    try {
        const { maxUserId, companyId, houseId, apartment, phone, name } = req.body;

        if (!maxUserId || !companyId || !houseId || !apartment) {
            return res.status(400).json({
                error: 'Поля maxUserId, companyId, houseId и apartment обязательны'
            });
        }

        const updatedResident = await prisma.resident.update({
            where: { maxUserId: String(maxUserId) },
            data: {
                companyId: String(companyId),
                houseId: Number(houseId),
                apartment: String(apartment).trim(),
                ...(phone ? { phone: String(phone).trim() } : {}),
                ...(name ? { name: String(name).trim() } : {})
            },
            include: {
                company: { select: { id: true, name: true } },
                house: { select: { id: true, address: true } }
            }
        });

        return res.json({
            success: true,
            resident: updatedResident,
            message: 'Адрес успешно сохранен'
        });
    } catch (error) {
        console.error('Ошибка сохранения профиля:', error);
        return res.status(500).json({ error: 'Не удалось сохранить профиль' });
    }
});

export default router;