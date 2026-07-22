export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const TOKEN = process.env.CORE_TOKEN;
  const CORE_URL = process.env.CORE_URL || "https://api.yourdomain.com";

  if (!TOKEN) {
    return res.status(400).json({ error: "Environment variable CORE_TOKEN is missing in Vercel." });
  }

  // Определяем публичный URL верселя
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const webhookUrl = `${protocol}://${host}/api/webhook`;

  console.log("Регистрация вебхука:", webhookUrl);

  try {
    // 1. Регистрируем Webhook Connection
    const connRes = await fetch(`${CORE_URL}/api/modules/me/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
      body: JSON.stringify({ webhookUrl })
    });

    if (!connRes.ok) {
      const err = await connRes.json();
      return res.status(500).json({ error: "Failed to register connection in Core", details: err });
    }

    // 2. Регистрируем Схему настроек
    const schema = {
      instruction: "Привет! Я Vercel-модуль. Отправьте мне настройки, чтобы я проверил их через Webhook.",
      fields: [
        { key: "test_number", type: "number", label: "Случайное число", defaultValue: 42, required: true },
        { key: "test_boolean", type: "boolean", label: "Включить магию?", required: true }
      ]
    };

    const schemaRes = await fetch(`${CORE_URL}/api/modules/me/schema`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
      body: JSON.stringify(schema)
    });

    if (!schemaRes.ok) {
      const err = await schemaRes.json();
      return res.status(500).json({ error: "Failed to register schema in Core", details: err });
    }

    // 3. Отправляем начальный статус (Ожидание настроек)
    await fetch(`${CORE_URL}/api/modules/me/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
      body: JSON.stringify({ status: "warning", message: "Ожидание конфигурации из UI" })
    });

    return res.json({ 
      success: true, 
      message: "Модуль успешно инициализирован и привязан к Ядру!", 
      webhookUrl 
    });

  } catch (e) {
    console.error("Ошибка setup:", e);
    return res.status(500).json({ error: "Internal Server Error", message: e.message });
  }
}
