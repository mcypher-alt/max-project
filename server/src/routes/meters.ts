import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js'; 

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<any> => {
    const { companyId, address, type, value } = req.body;

    if (!companyId || !address || !type || value === undefined) {
        return res.status(400).json({ error: 'Переданы не все данные для фиксации показаний' });
    }

    try {
        const reading = await prisma.meterReading.create({
            data: {
                companyId,
                address,
                type, // 'ХВС', 'ГВС' или 'ЭЭ'
                value: parseFloat(value) // Принудительно приводим к числу с плавающей точкой
            }
        });

        return res.status(201).json(reading);
    } catch (error) {
        console.error('Ошибка при сохранении счетчиков:', error);
        return res.status(500).json({ error: 'Ошибка сервера при записи показаний' });
    }
});

router.get('/', async (req: Request, res: Response): Promise<any> => {
    try {
        const { companyId, address, type } = req.query;
        if (!companyId || !type) {
            return res.status(400).json({ error: 'Не указан тип показаний или компания' });
        }

        const whereClause: any = {
            companyId: String(companyId),
            type: String(type),
        };

        if (address) {
            whereClause.address = String(address);
        }

        const meters = await prisma.meterReading.findMany({
            where: whereClause,
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        return res.json({ meters });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

export default router;