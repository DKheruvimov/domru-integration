export default async function handler(req, res) {
  // Обрабатываем только POST запросы (вебхуки от Ядра)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { event, data } = req.body;
  console.log(`\n📥 [Vercel Webhook] Получено событие от Ядра: ${event}`);
  console.log("Данные:", data);

  // Имитация обработки настроек
  if (event === "settings_updated") {
    // В реальном модуле (ТГ-боте) здесь вы бы сохранили настройки в БД
    const isValid = Number(data.test_number) === 110726 && String(data.test_boolean) === "true";
    
    if (isValid) {
      console.log("✅ Настройки ВАЛИДНЫ.");
      // Опционально можно дернуть REST API ядра, чтобы явно сообщить статус
      // POST /api/modules/actions/status (если будет реализовано)
    } else {
      console.log("❌ Настройки НЕВАЛИДНЫ.");
    }
  }

  // Vercel должен быстро вернуть 200 OK, чтобы Ядро знало, что вебхук доставлен
  return res.status(200).json({ success: true, message: "Webhook received" });
}
