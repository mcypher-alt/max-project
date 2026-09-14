import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js'; 

const router = Router();

router.post('/callback', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id, status } = req.body; // SMS Aero присылает id сессии и status (1 или 2 = успех)

    if (status === 1 || status === 2) {
      // Ищем запись по code (где у нас лежит sessionId)
      const resetRecord = await prisma.passwordReset.findFirst({
        where: { code: String(id) }
      });

      if (resetRecord) {
        // Помечаем в базе, что PUSH успешно подтвержден!
        // (Например, можно дописать флаг или обновить поле)
        await prisma.passwordReset.update({
          where: { phone: resetRecord.phone },
          data: { code: `APPROVED_${id}` } // Помечаем как подтверждено
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Callback error' });
  }
});

router.get('/check-status/:sessionId', async (req: Request<{ sessionId: string }>, res: Response): Promise<any> => {
  try {
    const { sessionId } = req.params;

    // Ищем запись в базе, где code содержит этот sessionId
    const resetRecord = await prisma.passwordReset.findFirst({
      where: { 
        // Если PUSH подтвержден, там будет 'APPROVED_123', если нет — просто '123'
        code: { contains: sessionId } 
      }
    });

    if (!resetRecord) {
      return res.json({ status: 'expired' });
    }

    if (resetRecord.code.startsWith('APPROVED_')) {
      return res.json({ status: 'approved' });
    }

    return res.json({ status: 'pending' });
  } catch (error) {
    return res.status(500).json({ error: 'Ошибка проверки статуса' });
  }
});

export default router;