import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import usersRouter from './routes/users.js';
import ticketsRouter from './routes/tickets.js';
import metersRouter from './routes/meters.js';
import loginRouter from './routes/login.js';
import registrationRouter from './routes/registration.js';
import houseRouter from './routes/houses.js';
import passwordRouter from './routes/password.js';
import mobileRouter from './routes/mobile-id.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173'], // Добавь сюда порты своего фронтенда
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

app.use('/api/mobile-id', mobileRouter);
app.use('/api/password', passwordRouter);
app.use('/api/houses', houseRouter);
app.use('/api/users', usersRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/meters', metersRouter);
app.use('/api/login', loginRouter);
app.use('/api/registration', registrationRouter);

app.get('/health', (req, res) => {
    res.json({status: "ok", message: "Сервер работает."});
});

app.listen(PORT, () => {
    console.log(`Бэкенд запущен на http://localhost:${PORT}`);
});