import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * 1. GET / — Публичный список домов для Тильды или выпадающих списков (БЕЗ auth)
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
    const { companyId } = req.query;

    if (!companyId) {
        return res.status(400).json({ error: 'Параметр companyId обязателен' });
    }

    try {
        const houses = await prisma.house.findMany({
            where: { companyId: String(companyId) },
            orderBy: { address: 'asc' } // Сортируем по алфавиту
        });

        const addressList = houses.map(h => h.address);
        return res.json({ addresses: addressList });
    } catch (error) {
        console.error('Ошибка при получении списка домов:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * 2. POST / — Добавление нового дома в обслуживаемый фонд (Только Диспетчер / Админ)
 */
router.post('/', requireAuth(['dispatcher', 'admin']), async (req: Request, res: Response): Promise<any> => {
    // 1. Сразу чистим пробелы и приводим к строке
    const cleanAddress = String(req.body.address || '').trim();
    const targetCompanyId = String(req.body.companyId || '').trim();

    // 2. Валидация
    if (!targetCompanyId || !cleanAddress) {
        return res.status(400).json({ error: 'Поля companyId и address обязательны' });
    }

    if (cleanAddress.length < 3 || cleanAddress.length > 200) {
        return res.status(400).json({ error: 'Длина адреса должна быть от 3 до 200 символов' });
    }

    try {
        // 3. Проверяем дубликат
        const houseExists = await prisma.house.findUnique({
            where: {
                address_companyId: {
                    address: cleanAddress,
                    companyId: targetCompanyId
                }
            }
        });

        if (houseExists) {
            return res.status(400).json({ 
                error: 'Этот адрес уже зарегистрирован в данной УК' 
            });
        }

        // 4. Создаем дом
        const newHouse = await prisma.house.create({
            data: {
                address: cleanAddress,
                company: {
                    connect: { id: targetCompanyId }
                }
            }
        });

        return res.status(201).json({ house: newHouse });
    } catch (error) {
        console.error('Ошибка при создании дома:', error);
        return res.status(500).json({ error: 'Не удалось сохранить дом в базу' });
    }
});

export default router;