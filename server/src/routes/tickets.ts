import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * 1. POST / — Создание заявки из веб-панели (Диспетчер / Админ)
 */
router.post('/', requireAuth(['dispatcher', 'admin']), async (req: Request, res: Response): Promise<any> => {
    const { companyId, address, description, type, photos } = req.body;

    if (!companyId || !address || !description || !type) {
        return res.status(400).json({ error: 'Все поля (companyId, address, description, type) обязательны' });
    }

    if (type !== 'emergency' && type !== 'regular') {
        return res.status(400).json({ error: "Тип заявки должен быть либо 'emergency', либо 'regular'" });
    }

    try {
        const houseExists = await prisma.house.findUnique({
            where: {
                address_companyId: {
                    address: String(address).trim(),
                    companyId: String(companyId)
                }
            }
        });

        if (!houseExists) {
            return res.status(400).json({ 
                error: 'Указанный адрес не обслуживается нашей управляющей компанией' 
            });
        }

        const newTicket = await prisma.ticket.create({
            data: {
                address: String(address).trim(),
                description,
                type,
                status: 'new',
                company: { connect: { id: companyId } },
                photos: photos?.length
                    ? {
                        create: photos.map((url: string) => ({ url }))
                    }
                    : undefined
            },
            include: {
                photos: true
            }
        });

        return res.status(201).json(newTicket);
    } catch (error) {
        console.error('Ошибка при создании заявки:', error);
        return res.status(500).json({ error: 'Не удалось сохранить заявку в базу' });
    }
});

router.post('/by-master', requireAuth(['master']), async (req: Request, res: Response): Promise<any> => {
    const { address, description, type, photos } = req.body;
    
    // Данные мастера гарантированно достаем из авторизации (JWT / session)
    const masterId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!address || !description || !type) {
        return res.status(400).json({ error: 'Поля address, description и type обязательны' });
    }

    if (type !== 'emergency' && type !== 'regular') {
        return res.status(400).json({ error: "Тип заявки должен быть 'emergency' или 'regular'" });
    }

    try {
        const houseExists = await prisma.house.findUnique({
            where: {
                address_companyId: {
                    address: String(address).trim(),
                    companyId: String(companyId)
                }
            }
        });

        if (!houseExists) {
            return res.status(400).json({ 
                error: 'Указанный адрес не обслуживается вашей компанией' 
            });
        }

        const newTicket = await prisma.ticket.create({
            data: {
                address: String(address).trim(),
                description,
                type,
                status: 'in_work',         // Мастер сразу берет ее в работу
                assignedAt: new Date(),     // Фиксируем время назначения
                company: { connect: { id: companyId } },
                master: { connect: { id: masterId } },
                photos: photos?.length
                    ? {
                        create: photos.map((url: string) => ({ url }))
                      }
                    : undefined
            },
            include: {
                photos: true,
                master: {
                    select: { id: true, name: true }
                }
            }
        });

        return res.status(201).json(newTicket);
    } catch (error) {
        console.error('Ошибка при создании заявки мастером:', error);
        return res.status(500).json({ error: 'Не удалось сохранить заявку мастера' });
    }
});

/**
 * 2. POST /assign — Назначение мастера на заявку (Диспетчер / Админ)
 */
router.post('/assign', requireAuth(['dispatcher', 'admin']), async (req: Request, res: Response): Promise<any> => {
    const { ticketId, masterId } = req.body;

    if (!ticketId || !masterId) {
        return res.status(400).json({ error: 'Необходимо передать ticketId и masterId' });
    }

    try {
        const updatedTicket = await prisma.ticket.update({
            where: { id: Number(ticketId) },
            data: {
                masterId: Number(masterId),
                status: 'new',
                assignedAt: new Date()
            }
        });

        return res.json({ success: true, ticket: updatedTicket });
    } catch (error) {
        console.error('Ошибка при назначении мастера:', error);
        return res.status(500).json({ error: 'Не удалось назначить мастера' });
    }
});

/**
 * 3. POST /master/accept — Принятие заявки мастером (Мастер / Админ)
 */
router.post('/master/accept', requireAuth(['master', 'admin']), async (req: Request, res: Response): Promise<any> => {
    const { ticketId } = req.body;

    if (!ticketId) {
        return res.status(400).json({ error: 'Необходимо передать ticketId' });
    }

    try {
        // ID мастера берем строго из авторизованного юзера в куке (req.user)
        const ticket = await prisma.ticket.update({
            where: { id: Number(ticketId) },
            data: {
                status: 'in_work',
                masterId: req.user!.id 
            }
        });

        return res.json({ success: true, ticket });
    } catch (error) {
        console.error('Ошибка при принятии заявки мастером:', error);
        return res.status(500).json({ error: 'Не удалось обновить статус' });
    }
});

/**
 * 4. POST /master/complete — Завершение заявки мастером (Мастер / Админ)
 */
router.post('/master/complete', requireAuth(['master', 'admin']), async (req: Request, res: Response): Promise<any> => {
    const { ticketId } = req.body;

    if (!ticketId) {
        return res.status(400).json({ error: 'Необходимо передать ticketId' });
    }

    try {
        const existingTicket = await prisma.ticket.findUnique({ where: { id: Number(ticketId) } });
        
        // Авторизованный мастер из куки не должен иметь возможности завершить чужую заявку
        if (req.user!.role !== 'admin' && existingTicket?.masterId !== req.user!.id) {
            return res.status(403).json({ error: 'Вы не можете завершить чужую заявку' });
        }

        const ticket = await prisma.ticket.update({
            where: { id: Number(ticketId) },
            data: {
                status: 'completed',
                completedAt: new Date()
            }
        });

        return res.json({ success: true, ticket });
    } catch (error) {
        console.error('Ошибка при завершении заявки мастером:', error);
        return res.status(500).json({ error: 'Не удалось завершить заявку' });
    }
});

/**
 * 5. POST /dispatcher/close — Принудительное закрытие заявки (Диспетчер / Админ)
 */
router.post('/dispatcher/close', requireAuth(['dispatcher', 'admin']), async (req: Request, res: Response): Promise<any> => {
    const { ticketId } = req.body;

    if (!ticketId) {
        return res.status(400).json({ error: 'Необходимо передать ticketId' });
    }

    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: Number(ticketId) }
        });

        if (!ticket) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        // Диспетчерам запрещено закрывать заявки чужой компании
        if (req.user!.role !== 'admin' && ticket.companyId !== req.user!.companyId) {
            return res.status(403).json({ error: 'Вы не можете управлять заявками чужой управляющей компании' });
        }

        const updatedTicket = await prisma.ticket.update({
            where: { id: Number(ticketId) },
            data: {
                status: 'completed',
                completedAt: new Date()
            }
        });

        return res.json({ success: true, ticket: updatedTicket });
    } catch (error) {
        console.error('Ошибка при закрытии заявки диспетчером:', error);
        return res.status(500).json({ error: 'Не удалось закрыть заявку' });
    }
});

/**
 * 6. POST /tilda-direct-ticket — Публичный эндпоинт заявки с Тильды (БЕЗ auth)
 */
router.post('/tilda-direct-ticket', async (req: Request, res: Response): Promise<any> => {
    try {
        const { address, description, type, companyId } = req.body;
        
        const trackingToken = crypto.randomBytes(8).toString('hex');

        const newTicket = await prisma.ticket.create({
            data: {
                address,
                description,
                type: type || 'regular',
                status: 'new',
                companyId,
                trackingToken
            }
        });

        const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
        const trackingLink = `${clientUrl}/status/${trackingToken}`;

        return res.status(200).json({ 
            success: true, 
            trackingLink
        }); 
    } catch (error) {
        console.error('Ошибка при создании заявки с Тильды:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * 7. GET /my — Личные заявки мастера (Мастер / Админ)
 */
router.get('/my', requireAuth(['master', 'admin']), async (req: Request, res: Response): Promise<any> => {
    try {
        const { status } = req.query;

        // masterId и companyId автоматически берутся из куки авторизации!
        const whereClause: any = {
            companyId: req.user!.companyId,
            masterId: req.user!.id
        };

        if (status) {
            whereClause.status = String(status);
        } else {
            whereClause.status = { in: ['new', 'in_work'] }; 
        }

        const myTickets = await prisma.ticket.findMany({
            where: whereClause,
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.json({ tickets: myTickets });
    } catch (error) {
        console.error('Ошибка при получении заявок мастера:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * 8. GET / — Список всех заявок для рабочего стола (Диспетчер / Админ)
 */
router.get('/', requireAuth(['dispatcher', 'admin']), async (req: Request, res: Response): Promise<any> => {
    try {
        const { companyId, masterId, status, type } = req.query;

        const whereClause: any = {};

        // Если с фронта явно передан companyId (например, диспетчер переключает компании)
        if (companyId) {
            if (Array.isArray(companyId)) {
                whereClause.companyId = { in: companyId.map(id => String(id)) };
            } else if (String(companyId).includes(',')) {
                const companiesArray = String(companyId).split(',').map(id => id.trim());
                whereClause.companyId = { in: companiesArray };
            } else {
                whereClause.companyId = String(companyId);
            }
        } else {
            // Если компании не переданы в query — ограничиваем юзера его компанией
            whereClause.companyId = req.user!.companyId;
        }

        if (masterId === 'null') {
            whereClause.masterId = null;
        } else if (masterId) {
            whereClause.masterId = parseInt(masterId as string);
        }
        
        if (status) {
            whereClause.status = String(status);
        }
        
        if (type) {
            whereClause.type = String(type);
        }

        const tickets = await prisma.ticket.findMany({
            where: whereClause,
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.json({ tickets });
    } catch (error) {
        console.error('Ошибка получения заявок:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;