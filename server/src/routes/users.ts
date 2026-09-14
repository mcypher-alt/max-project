import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js'; 
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// 2. GET /masters — Список мастеров (для выпадающего списка при назначении заявки)
router.get('/masters', requireAuth(['dispatcher', 'admin']), async (req: Request, res: Response): Promise<any> => {
    const { companyId } = req.query;

    if (!companyId) {
        return res.status(400).json({ error: 'companyId обязателен' });
    }

    try {
        const masters = await prisma.user.findMany({
            where: {
                companyId: String(companyId),
                role: 'master' // Тянем только мастеров
            },
            select: {
                id: true,
                name: true,
                phone: true
            }
        });

        return res.json({ masters });
    } catch (error) {
        console.error('Ошибка при получении списка мастеров:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// 3. GET /:id/workload — Проверка нагрузки мастера (сколько у него активных заявок)
router.get('/:id/workload', requireAuth(['dispatcher', 'admin']), async (req: Request, res: Response): Promise<any> => {
    try {
        const masterId = parseInt(req.params.id as string);
        const { companyId } = req.query;

        if (isNaN(masterId) || !companyId) {
            return res.status(400).json({ error: 'Некорректные параметры запроса' });
        }

        const master = await prisma.user.findFirst({
            where: {
                id: masterId,
                // Так как диспетчер имеет доступ к обеим УК, доверяем companyId из запроса
                companyId: String(companyId)
            }
        });

        if (!master) {
            return res.status(404).json({ error: 'Мастер не найден в указанной управляющей компании' });
        }

        const activeTicketsCount = await prisma.ticket.count({
            where: {
                masterId: masterId,
                status: { in: ['new', 'in_work'] }
            }
        });

        return res.json({
            hasActiveTickets: activeTicketsCount > 0,
            count: activeTicketsCount
        });

    } catch (error) {
        console.error('Ошибка сервера при проверке нагрузки мастера:', error);
        return res.status(500).json({ error: 'Ошибка сервера при проверке нагрузки мастера' });
    }
});

export default router;