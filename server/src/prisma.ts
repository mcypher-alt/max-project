import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

async function initDb() {
    try {
        // Включаем WAL режим
        await prisma.$executeRawUnsafe(`PRAGMA journal_mode=WAL;`);
        // Говорим базе ждать до 5000мс (5 секунд), если она занята, а не падать сразу
        await prisma.$executeRawUnsafe(`PRAGMA busy_timeout=5000;`);
        console.log('--- SQLite переведена в режим WAL, busy_timeout=5000мс ---');
    } catch (error) {
        console.error('Не удалось настроить прагмы SQLite:', error);
    }
}

initDb();