import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const router = Router();

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (JPEG, PNG, WEBP, GIF)'));
    }
  },
});

router.post('/upload', requireAuth(['master', 'dispatcher', 'admin']), (req, res): any => {
  upload.single('photo')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Ошибка загрузки: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не выбран' });
    }

    const bucketName = process.env.S3_BUCKET_NAME || 'photos';
    const publicUrl = process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${bucketName}`;

    try {
      const ext = path.extname(file.originalname).toLowerCase();
      const fileName = `${crypto.randomUUID()}${ext}`;
      const key = `uploads/${fileName}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      return res.json({ url: `${publicUrl}/${key}` });

    } catch (uploadError: any) {
      console.error('Ошибка отправки в S3:', uploadError);
      return res.status(500).json({ error: 'Не удалось сохранить файл в хранилище' });
    }
  });
});

export default router;