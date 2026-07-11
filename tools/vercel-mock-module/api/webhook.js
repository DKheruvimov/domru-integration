export default async function handler(req, res) {
  // Обрабатываем только POST запросы (вебхуки от Ядра)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { event, payload } = req.body;
  console.log(`\n📥 [Vercel Webhook] Получено событие от Ядра: ${event}`);
  console.log("Данные:", payload);

  // Имитация обработки настроек
  if (event === "settings_updated") {
    // В реальном модуле (ТГ-боте) здесь вы бы сохранили настройки в БД
    const isValid = Number(payload.test_number) === 110726 && String(payload.test_boolean) === "true";
    
    if (isValid) {
      console.log("✅ Настройки ВАЛИДНЫ.");
      await fetch(`${process.env.CORE_URL || "https://api.kheruvimov.ru"}/api/modules/me/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CORE_TOKEN}` },
        body: JSON.stringify({ status: "online", message: "Настройки валидны. Подключено к ТГ. Плагин готов к работе!" })
      });
    } else {
      console.log("❌ Настройки НЕВАЛИДНЫ.");
      await fetch(`${process.env.CORE_URL || "https://api.kheruvimov.ru"}/api/modules/me/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CORE_TOKEN}` },
        body: JSON.stringify({ status: "warning", message: "Требуются настройки. Задайте число 110726 и включите магию в UI." })
      });
    }
  }

  // Vercel должен быстро вернуть 200 OK, чтобы Ядро знало, что вебхук доставлен
  return res.status(200).json({ success: true, message: "Webhook received" });
}
