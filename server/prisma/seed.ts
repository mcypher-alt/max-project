import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начинаем глобальную зачистку и сидирование базы...\n');

  // ==========================================
  // 0. ОЧИСТКА БАЗЫ (СТРОГО В ТАКОМ ПОРЯДКЕ)
  // Сначала удаляем то, что ссылается на другие таблицы,
  // чтобы не словить ошибку внешних ключей (Foreign Key)
  // ==========================================
  await prisma.meterReading.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.validToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
  
  console.log('🧹 База данных успешно очищена.');

  // Единый пароль для всех, чтобы было удобно тестить
  const plainPassword = 'password123';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // ==========================================
  // 1. КОМПАНИИ (Родительская таблица)
  // ==========================================
  console.log('🏢 Создаем управляющие компании...');
  
  const crocus = await prisma.company.create({ 
    data: { id: 'crocus', name: 'УК "Крокус"' } 
  });
  
  const meridian = await prisma.company.create({ 
    data: { id: 'meridian', name: 'УК "Меридиан"' } 
  });


  // ==========================================
  // 2. ПЕРСОНАЛ (Привязан к компаниям)
  // ==========================================
  console.log('👷 Создаем персонал...');

  // Админ и Диспетчер для Крокуса
  const adminCrocus = await prisma.user.create({
    data: { phone: '79991111111', password: hashedPassword, name: 'Иван (Админ)', role: 'admin', companyId: crocus.id },
  });

  const dispatcherCrocus = await prisma.user.create({
    data: { phone: '79992222222', password: hashedPassword, name: 'Анна (Диспетчер)', role: 'dispatcher', companyId: crocus.id },
  });

  // Мастера Крокуса
  const masterPetrovich = await prisma.user.create({
    data: { phone: '79993333333', password: hashedPassword, name: 'Петрович (Сантехник)', role: 'master', companyId: crocus.id },
  });

  const masterIvanovich = await prisma.user.create({
    data: { phone: '79994444444', password: hashedPassword, name: 'Иванович (Электрик)', role: 'master', companyId: crocus.id },
  });

  // Мастер для Меридиана (для проверки изоляции)
  const masterMeridian = await prisma.user.create({
    data: { phone: '79995555555', password: hashedPassword, name: 'Сергеич (Мастер Меридиан)', role: 'master', companyId: meridian.id },
  });


  // ==========================================
  // 3. ЗАЯВКИ / TICKETS (Привязаны к компаниям и мастерам)
  // ==========================================
  console.log('📝 Генерируем заявки...');

  // Новая заявка (никто не назначен)
  await prisma.ticket.create({
    data: {
      address: 'ул. Ленина, д. 10, кв. 42',
      description: 'Прорвало батарею в зале!',
      type: 'emergency',
      status: 'new',
      companyId: crocus.id,
    },
  });

  // Заявка в работе у Петровича
  await prisma.ticket.create({
    data: {
      address: 'ул. Пушкина, д. 5, кв. 12',
      description: 'Капает кран на кухне',
      type: 'regular',
      status: 'in_work',
      companyId: crocus.id,
      masterId: masterPetrovich.id,
      assignedAt: new Date(),
    },
  });

  // Выполненная заявка Петровича (с оценкой диспетчера)
  await prisma.ticket.create({
    data: {
      address: 'ул. Строителей, д. 1, кв. 1',
      description: 'Замена счетчика ХВС',
      type: 'regular',
      status: 'completed',
      companyId: crocus.id,
      masterId: masterPetrovich.id,
      assignedAt: new Date(Date.now() - 86400000), // Вчера
      completedAt: new Date(), // Сегодня
      managerRating: 5,
      managerComment: 'Сделал быстро и чисто, молодец',
    },
  });

  // Заявка другой компании (Меридиан)
  await prisma.ticket.create({
    data: {
      address: 'пр. Космонавтов, д. 100',
      description: 'Нет света в подъезде',
      type: 'regular',
      status: 'new',
      companyId: meridian.id,
    },
  });


  // ==========================================
  // 4. ПОКАЗАНИЯ СЧЕТЧИКОВ / METER READINGS
  // ==========================================
  console.log('💧 Добавляем показания счетчиков...');

  await prisma.meterReading.createMany({
    data: [
      { companyId: crocus.id, address: 'ул. Пушкина, д. 5, кв. 12', type: 'ХВС', value: 145.5 },
      { companyId: crocus.id, address: 'ул. Пушкина, д. 5, кв. 12', type: 'ЭЭ', value: 3402.0 },
      { companyId: meridian.id, address: 'пр. Космонавтов, д. 100, кв. 1', type: 'ГВС', value: 88.2 },
    ]
  });


  // ==========================================
  // 5. ТОКЕНЫ РЕГИСТРАЦИИ / VALID TOKENS
  // ==========================================
  console.log('🎟️  Генерируем тестовый инвайт-токен...');

  const expires = new Date();
  expires.setHours(expires.getHours() + 24);

  await prisma.validToken.create({
    data: {
      token: 'test-master-token',
      role: 'master',
      phone: '79822802456',
      companyId: crocus.id,
      expiresAt: expires,
    },
  });

  console.log('🏠 Создаем справочник домов...');

  await prisma.house.createMany({
    data: [
      { address: 'ул. Ленина, д. 10', companyId: crocus.id },
      { address: 'ул. Пушкина, д. 5', companyId: crocus.id },
      { address: 'ул. Строителей, д. 1', companyId: crocus.id },
      { address: 'пр. Космонавтов, д. 100', companyId: meridian.id },
    ],
  });


  console.log('\n✅ Сидирование успешно завершено! Все таблицы заполнены.');
  console.log('----------------------------------------------------');
  console.log('🔑 ДАННЫЕ ДЛЯ ВХОДА (Пароль у всех: password123):');
  console.log(`Админ "Крокус"     : ${adminCrocus.phone}`);
  console.log(`Диспетчер "Крокус" : ${dispatcherCrocus.phone}`);
  console.log(`Мастер Петрович    : ${masterPetrovich.phone}`);
  console.log(`Мастер Иванович    : ${masterIvanovich.phone}`);
  console.log(`Мастер "Меридиан"  : ${masterMeridian.phone}`);
  console.log('----------------------------------------------------');
  console.log('🔗 Ссылка для теста регистрации (Мастер, Крокус):');
  console.log('http://crocus.localhost:5173/?token=test-master-token');
}

main()
  .catch((e) => {
    console.error('❌ Критическая ошибка при сидировании:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });