import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Расширяем типизацию Express Request, чтобы TS знал про req.user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string;
        companyId: string;
      };
    }
  }
}

// Универсальный middleware проверки авторизации и ролей
export const requireAuth = (allowedRoles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): any => {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Необходима авторизация' });
    }

    try {
      // 1. Расшифровываем токен
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: number;
        role: string;
        companyId: string;
      };

      // 2. Записываем данные юзера в req, чтобы они были доступны в роутах
      req.user = decoded;

      // 3. Проверяем роли (если список ролей передан)
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role.toLowerCase())) {
        return res.status(403).json({ error: 'Недостаточно прав для выполнения операции' });
      }

      // 4. Всё ок — передаем управление дальше самому роуту
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Сессия истекла или недействительна' });
    }
  };
};