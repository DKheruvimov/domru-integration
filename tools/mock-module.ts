import { io } from "socket.io-client";
import fs from "fs";
import path from "path";
import readline from "readline";
import http from "http";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Get token from arguments: node tools/mock-module.js --token=mod_123
const tokenArg = process.argv.find(arg => arg.startsWith("--token="));
if (!tokenArg) {
  console.error("❌ Ошибка: Необходим токен!");
  console.error("Использование: npx tsx tools/mock-module.ts --token=твой_токен");
  process.exit(1);
}

const TOKEN = tokenArg.split("=")[1];
const CORE_URL = "https://kheruvimov.ru"; // Для тестов локально
const SETTINGS_FILE = path.join(process.cwd(), "data", "mock-settings.json");

console.log(`🚀 Запуск Mock-модуля с токеном: ${TOKEN}`);
console.log(`Подключение к Ядру: ${CORE_URL}...`);

// Загрузка локальных настроек
function loadLocalSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    } catch (e) {
      console.error("Ошибка чтения настроек:", e);
    }
  }
  return {};
}

function saveLocalSettings(data: any) {
  try {
    if (!fs.existsSync(path.dirname(SETTINGS_FILE))) {
      fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Ошибка сохранения настроек:", e);
  }
}

// 2. Функция регистрации Схемы настроек
async function registerSchema() {
  console.log("Отправка схемы настроек в Ядро...");
  const schema = {
    instruction: "Привет! Я Mock-модуль. Введите любые данные ниже, чтобы проверить, как Ядро передает их мне.",
    fields: [
      { key: "test_string", type: "string", label: "Тестовая строка", required: true },
      { key: "test_password", type: "password", label: "Секретный ключ", description: "Никому не показывайте" },
      { key: "test_number", type: "number", label: "Случайное число", defaultValue: 42, required: true },
      { key: "test_boolean", type: "boolean", label: "Включить магию?", required: true },
      { 
        key: "test_select", 
        type: "select", 
        label: "Выберите цвет", 
        options: [
          { label: "Красный", value: "red" },
          { label: "Синий", value: "blue" }
        ]
      }
    ]
  };

  try {
    const res = await fetch(`${CORE_URL}/api/modules/me/schema`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      },
      body: JSON.stringify(schema)
    });
    if (res.ok) {
      console.log("✅ Схема успешно зарегистрирована! Откройте UI Ядра и нажмите на шестеренку.");
    } else {
      console.error("❌ Ошибка регистрации схемы:", await res.json());
    }
  } catch (e) {
    console.error("❌ Не удалось отправить схему. Ядро запущено?", e);
  }
}

async function reportStatusWebhook(status: "offline" | "warning" | "error" | "online", message?: string) {
  // Для вебхуков мы не можем пушить статус напрямую через сокет. 
  // Но мы выводим его в консоль.
  console.log(`📤 [Webhook] Статус модуля: [${status}] ${message || ""}`);
}

function validateAndReportStatus(data: any, mode: "websocket" | "webhook" = "websocket") {
  // Имитация валидации
  if (Number(data.test_number) === 110726 && String(data.test_boolean) === "true") {
    const msg = "Настройки валидны. Подключено к ТГ. Плагин готов к работе!";
    mode === "websocket" ? reportStatusWS("online", msg) : reportStatusWebhook("online", msg);
  } else {
    const msg = "Требуются настройки. Задайте число 110726 и включите магию в UI.";
    mode === "websocket" ? reportStatusWS("warning", msg) : reportStatusWebhook("warning", msg);
  }
}

let socket: any;
function reportStatusWS(status: "offline" | "warning" | "error" | "online", message?: string) {
  console.log(`📤 Отправка статуса Ядру: [${status}] ${message || ""}`);
  if (socket) socket.emit("update_status", { status, message });
}

function startWebSocketMode() {
  console.log("🔌 Запуск в режиме WebSocket...");
  socket = io(CORE_URL + "/modules", { auth: { token: TOKEN } });

  socket.on("connect", () => {
    console.log("✅ Успешное подключение по WebSocket к Ядру!");
    const localSettings = loadLocalSettings();
    validateAndReportStatus(localSettings, "websocket");
    registerSchema();
  });

  socket.on("disconnect", () => console.log("❌ Отключено от Ядра."));
  socket.on("connect_error", (err: any) => console.error("⚠️ Ошибка подключения:", err.message));

  socket.on("incoming_call", (data: any) => console.log("🔔 [Событие] Входящий вызов!", data));
  socket.on("door_opened", (data: any) => console.log("🚪 [Событие] Дверь открыта!", data));
  
  socket.on("settings_updated", (data: any) => {
    console.log("⚙️ [Настройки] Ядро прислало новые настройки:", data);
    saveLocalSettings(data);
    console.log("🔄 Имитация проверки настроек и переподключения...");
    setTimeout(() => validateAndReportStatus(data, "websocket"), 1000);
  });
}

async function startWebhookMode() {
  console.log("🪝 Запуск в режиме Webhook...");
  
  rl.question("Введите публичный URL этого сервера (например, https://my-ngrok.ngrok-free.app/webhook): ", async (url) => {
    rl.close();
    if (!url.trim()) {
      console.log("URL не введен. Отмена.");
      process.exit(0);
    }

    // Регистрация webhook в ядре
    try {
      const res = await fetch(`${CORE_URL}/api/modules/actions/connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
        body: JSON.stringify({ type: "webhook", webhookUrl: url.trim() })
      });
      if (res.ok) console.log(`✅ Вебхук успешно зарегистрирован в Ядре: ${url.trim()}`);
      else {
          console.error("❌ Ошибка регистрации вебхука в Ядре:", await res.json());
          process.exit(1);
      }
    } catch (e) {
      console.error("Ошибка при обращении к Ядру:", e);
      process.exit(1);
    }

    const localSettings = loadLocalSettings();
    validateAndReportStatus(localSettings, "webhook");
    registerSchema();

    // Запуск локального HTTP сервера для приема вебхуков
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            console.log(`\n📥 Получен вебхук от Ядра [Событие: ${data.event}]:`, data.data);
            
            if (data.event === "settings_updated") {
              saveLocalSettings(data.data);
              setTimeout(() => validateAndReportStatus(data.data, "webhook"), 1000);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400);
            res.end();
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(3005, () => {
      console.log("\n🚀 Локальный Webhook-сервер запущен на порту 3005.");
      console.log("❗ Убедитесь, что вы пробросили порт 3005 через ngrok или localtunnel.");
      console.log("Ожидание событий от Ядра...\n");
    });
  });
}

// Запрашиваем тип подключения
rl.question("Выберите тип подключения (1 - WebSockets, 2 - Webhooks) [2]: ", (answer) => {
  const choice = answer.trim();
  if (choice === "1") {
    rl.close();
    startWebSocketMode();
  } else {
    // 2 или пустой Enter по умолчанию
    startWebhookMode();
  }
});
