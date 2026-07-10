import { io } from "socket.io-client";

// Get token from arguments: node tools/mock-module.js --token=mod_123
const tokenArg = process.argv.find(arg => arg.startsWith("--token="));
if (!tokenArg) {
  console.error("❌ Ошибка: Необходим токен!");
  console.error("Использование: npx tsx tools/mock-module.ts --token=твой_токен");
  process.exit(1);
}

const TOKEN = tokenArg.split("=")[1];
const CORE_URL = "https://kheruvimov.ru"; // Для тестов локально

console.log(`🚀 Запуск Mock-модуля с токеном: ${TOKEN}`);
console.log(`Подключение к Ядру: ${CORE_URL}...`);

// 1. Подключаемся по WebSocket
const socket = io(CORE_URL + "/modules", {
  auth: { token: TOKEN }
});

socket.on("connect", () => {
  console.log("✅ Успешное подключение по WebSocket к Ядру!");
  reportStatus("warning", "Модуль подключен, ожидаю конфигурации...");
  registerSchema();
});

socket.on("disconnect", () => {
  console.log("❌ Отключено от Ядра.");
});

socket.on("connect_error", (err) => {
  console.error("⚠️ Ошибка подключения:", err.message);
});

// Слушаем события от домофона
socket.on("incoming_call", (data) => {
  console.log("🔔 [Событие] Входящий вызов!", data);
});

socket.on("door_opened", (data) => {
  console.log("🚪 [Событие] Дверь открыта!", data);
});

// Отправка явного статуса плагина в Ядро
function reportStatus(status: "offline" | "warning" | "error" | "online", message?: string) {
  console.log(`📤 Отправка статуса Ядру: [${status}] ${message || ""}`);
  socket.emit("update_status", { status, message });
}

// Слушаем обновление настроек из UI
socket.on("settings_updated", (data) => {
  console.log("⚙️ [Настройки] Ядро прислало новые настройки:", data);
  
  if (!data.test_string) {
    reportStatus("error", "Отсутствует 'Тестовая строка'! Не могу продолжить работу.");
    return;
  }
  
  console.log("🔄 Имитация подключения к Telegram...");
  setTimeout(() => {
    if (data.test_string === "error") {
      reportStatus("error", "Тестовая строка содержит 'error'. Ошибка подключения к ТГ!");
    } else {
      reportStatus("online", "Успешно подключено к ТГ. Плагин готов к работе!");
    }
  }, 1000);
});

// 2. Функция регистрации Схемы настроек
async function registerSchema() {
  console.log("Отправка схемы настроек в Ядро...");
  
  const schema = {
    instruction: "Привет! Я Mock-модуль. Введите любые данные ниже, чтобы проверить, как Ядро передает их мне.",
    fields: [
      { key: "test_string", type: "string", label: "Тестовая строка", required: true },
      { key: "test_password", type: "password", label: "Секретный ключ", description: "Никому не показывайте" },
      { key: "test_number", type: "number", label: "Случайное число", defaultValue: 42 },
      { key: "test_boolean", type: "boolean", label: "Включить магию?" },
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
      const err = await res.json();
      console.error("❌ Ошибка регистрации схемы:", err);
    }
  } catch (e) {
    console.error("❌ Не удалось отправить схему. Ядро запущено?", e);
  }
}
