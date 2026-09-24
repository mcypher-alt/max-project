import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<any> => {
    try {
        const companies = await prisma.company.findMany({
            select: {
                id: true,
                name: true,
                houses: {
                    select: {
                        id: true,
                        address: true
                    },
                    orderBy: {
                        address: 'asc'
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return res.json({ companies });
    } catch (error) {
        console.error('Ошибка при получении списка УК:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.get('/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        const company = await prisma.company.findUnique({
            where: { id: String(id) },
            select: {
                id: true,
                name: true,
                houses: {
                    select: {
                        id: true,
                        address: true
                    },
                    orderBy: {
                        address: 'asc'
                    }
                }
            }
        });

        if (!company) {
            return res.status(404).json({ error: 'Управляющая компания не найдена' });
        }

        return res.json({ company });
    } catch (error) {
        console.error('Ошибка при получении УК:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

export default router;