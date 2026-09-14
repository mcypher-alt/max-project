export default function formatPhone(phone: string): string {
  // 1. Оставляем только цифры
  const cleaned = phone.replace(/\D/g, '');

  // 2. Если начинается с 89... (11 цифр), меняем первую 8 на 7
  if (cleaned.length === 11 && cleaned.startsWith('8')) {
    return '7' + cleaned.slice(1);
  }

  // 3. Если передали без кода страны (9XXXXXXXXX, 10 цифр), добавляем 7
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    return '7' + cleaned;
  }

  // 4. Если уже 11 цифр и начинается с 7 (например, 79XXXXXXXXX) — возвращаем как есть
  return cleaned;
}