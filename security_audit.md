# 🔍 Аудит безопасности и качества кода — domru-integration

---

## 🔴 Критические уязвимости безопасности

### 1. Токены и пароли в URL query-параметрах (открыты в логах и истории браузера)

**Файлы:** [yandexHelper.ts](file:///c:/Users/User/antigravity/domru-integration/server/yandexHelper.ts#L26-L33), [streamRoutes.ts](file:///c:/Users/User/antigravity/domru-integration/server/routes/streamRoutes.ts#L214-L215), [streamRoutes.ts](file:///c:/Users/User/antigravity/domru-integration/server/routes/streamRoutes.ts#L326-L330)

**Проблема:** Пароли, токены и refreshTokens передаются в URL query-параметрах:
```
/api/domru/stream-proxy/index.m3u8?url=...&token=XXXXX&refreshToken=YYYYY&password=ZZZZZ
```
Они попадают в:
- Логи Nginx и access.log (видны администратору сервера)
- Историю браузера пользователя
- Реферер-заголовки при переходах (Referer header leakage)
- Логи Cloudflare (если используется)

> [!CAUTION]
> Это самая серьёзная уязвимость в проекте. Даже при HTTPS соединении, URL-параметры сохраняются в логах на всех промежуточных точках.

**Решение:** Использовать short-lived JWT или зашифрованные сессионные идентификаторы вместо передачи raw-токенов в URL. Например:
- Перед созданием stream-proxy URL сгенерировать одноразовый `sessionId` → сохранить его в in-memory Map с привязкой к реальным credentials.
- В stream-proxy вместо `?token=xxx&password=yyy` передавать `?sid=abc123`.
- Через 1 час автоматически удалять запись из Map.

---

### 2. `NODE_TLS_REJECT_UNAUTHORIZED = "0"` — глобальное отключение проверки SSL-сертификатов

**Файл:** [config.ts:4](file:///c:/Users/User/antigravity/domru-integration/server/config.ts#L4)

```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
```

**Проблема:** Это глобальная настройка, которая отключает проверку SSL-сертификатов для **всех** исходящих HTTPS-запросов, включая:
- Запросы к GitHub API (если бы использовались)
- Запросы к Яндекс API  
- Все `npm`-пакеты, которые делают HTTPS-запросы  

Это открывает проект для атак MITM (Man-in-the-Middle) на **любом** этапе, не только при работе с видеопотоками Дом.ру.

> [!WARNING]
> Понимаю, что это сделано из-за невалидных сертификатов на поддоменах proptech.ru/domru.ru, но решение слишком грубое.

**Решение:** Вместо глобального отключения, передавать `rejectUnauthorized: false` точечно только в те axios/https-запросы, которые обращаются к домерам `proptech.ru` / `domru.ru` / `ertelecom.ru`. В axios это делается через `httpsAgent`:
```typescript
import https from "https";
const domruAgent = new https.Agent({ rejectUnauthorized: false });

// Только для запросов к Дом.ру:
axios.get(url, { httpsAgent: domruAgent });
```

---

### 3. Отсутствие Rate Limiting на критических эндпоинтах

**Файлы:** [authRoutes.ts](file:///c:/Users/User/antigravity/domru-integration/server/routes/authRoutes.ts) (login, SMS endpoints), [doorRoutes.ts](file:///c:/Users/User/antigravity/domru-integration/server/routes/doorRoutes.ts#L60) (open door)

**Проблема:** Нет ограничений на количество запросов к:
- `/api/domru/login` — перебор паролей
- `/api/domru/sms/request` — спам-рассылка SMS (и штрафы от оператора)
- `/api/domru/sms/confirm` — перебор SMS-кодов
- `/api/domru/open` — бесконтрольное открытие дверей ботами

> [!IMPORTANT]
> Без rate-limiting злоумышленник может отправлять тысячи SMS или подбирать 4-значный код (10000 комбинаций) за секунды.

**Решение:** Установить `express-rate-limit`:
```
npm install express-rate-limit
```
```typescript
import rateLimit from "express-rate-limit";
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
router.post("/login", authLimiter, async (req, res) => { ... });
router.post("/sms/request", rateLimit({ windowMs: 60000, max: 3 }), ...);
```

---

### 4. CORS с wildcard `origin: "*"` на WebSocket-сервере

**Файл:** [ws-manager.ts:8-11](file:///c:/Users/User/antigravity/domru-integration/server/ws-manager.ts#L8-L11)

```typescript
io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
```

**Проблема:** Любой сайт в интернете может подключиться к вашему WebSocket серверу и получать:
- Уведомления об автооткрытии дверей (`auto_open_status_changed`)
- SIP-логи (`sip_log_added`)  
- Информацию о входящих звонках (`sip_incoming_call`)
- Уведомления об открытии дверей (`door_opened`)

**Решение:** Ограничить origin до вашего домена:
```typescript
cors: { origin: ["https://yourdomain.ru", "http://localhost:3000"] }
```

---

### 5. Эндпоинт чтения файлов — риск Path Traversal

**Файл:** [codeRoutes.ts:29-44](file:///c:/Users/User/antigravity/domru-integration/server/routes/codeRoutes.ts#L29-L44)

**Проблема:** Валидация пути проверяет только `startsWith`, но не нормализует путь:
```typescript
if (!filePath.startsWith("src/domru-js/") && !filePath.startsWith("examples/") && !filePath.startsWith("tests/")) {
  return res.status(403).json({ error: "Access denied" });
}
```
Потенциально можно обойти через `src/domru-js/../../server/tokenStore.ts` и прочитать файлы с токенами.

**Решение:** Нормализовать путь перед проверкой:
```typescript
const normalized = path.normalize(filePath).replace(/\\/g, "/");
if (!normalized.startsWith("src/domru-js/") && ...) { ... }
// + проверить, что resolved-путь не выходит за пределы CWD
const absolutePath = path.resolve(process.cwd(), normalized);
if (!absolutePath.startsWith(process.cwd())) { return res.status(403)... }
```

---

## 🟠 Серьёзные проблемы архитектуры и надёжности

### 6. Незащищённые эндпоинты — открытие двери без авторизации

**Файл:** [doorRoutes.ts:60](file:///c:/Users/User/antigravity/domru-integration/server/routes/doorRoutes.ts#L60)

**Проблема:** Эндпоинт `POST /api/domru/open` не использует middleware `requireDomruAuth`. Теоретически любой, кто знает `placeId` и `deviceId`, может отправить запрос на открытие двери. Защита держится только на том, что нужен валидный токен в headers для создания DomruClient. Но если кто-то подставит `x-domru-demo: true` — дверь "откроется" в демо-режиме.

Аналогично, эндпоинт `/api/domru/snapshot/:placeId/:deviceId` не имеет защиты.

**Решение:** Добавить `requireDomruAuth` middleware перед всеми мутирующими действиями:
```typescript
router.post("/open", requireDomruAuth, async (req, res) => { ... });
```

---

### 7. Токены хранятся в открытом виде на диске

**Файл:** [tokenStore.ts](file:///c:/Users/User/antigravity/domru-integration/server/tokenStore.ts)

**Проблема:** Файл `data/tokens.json` содержит пароли и refresh-токены пользователей в plain JSON. Если сервер скомпрометирован (через другую уязвимость), злоумышленник получает доступ ко всем учёткам сразу.

**Решение:** Шифровать содержимое файла с помощью ключа из переменной окружения:
```typescript
import crypto from "crypto";
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || "default-dev-key-change-me";
```

---

### 8. Утечка чувствительных данных в логах

**Файлы:** [domruClientHelper.ts:316-320](file:///c:/Users/User/antigravity/domru-integration/server/domruClientHelper.ts#L316-L320), [streamRoutes.ts:431](file:///c:/Users/User/antigravity/domru-integration/server/routes/streamRoutes.ts#L431)

```typescript
console.log(`[TOKEN_DEBUG] Raw token (first 60): ${token.substring(0, 60)}`);
console.log(`[TOKEN_DEBUG] Clean token: ${cleanToken}`);
console.log(`[STREAM_PROXY] Token refreshed successfully: ${currentToken}`);
```

**Проблема:** Токены авторизации пишутся в stdout/stderr, который попадает в логи Docker/systemd/pm2. Если логи хранятся долго или отправляются в систему мониторинга — это утечка.

**Решение:** Заменить на маскированные значения:
```typescript
console.log(`[TOKEN_DEBUG] Token: ${token.substring(0, 8)}...${token.substring(token.length - 4)}`);
```

---

### 9. Избыточные импорты во всех route-файлах

**Файлы:** Все файлы в `server/routes/` ([authRoutes.ts](file:///c:/Users/User/antigravity/domru-integration/server/routes/authRoutes.ts#L1-L25), [doorRoutes.ts](file:///c:/Users/User/antigravity/domru-integration/server/routes/doorRoutes.ts#L1-L26), [eventsRoutes.ts](file:///c:/Users/User/antigravity/domru-integration/server/routes/eventsRoutes.ts#L1-L25), [peopleRoutes.ts](file:///c:/Users/User/antigravity/domru-integration/server/routes/peopleRoutes.ts#L1-L26))

**Проблема:** Каждый файл маршрутов импортирует **все** зависимости проекта, включая те, которые ему не нужны (`axios`, `spawn`, `execSync`, `DomruClient`, `parseMpegTsCodecs` и т.д.). Это похоже на то, что файлы были разбиты из одного `domruRoutes.ts`, но импорты не были вычищены.

Последствия:
- Увеличение времени загрузки сервера (circular dependency risk)
- Путаница для разработчика — непонятно, что файл реально использует
- Потенциальные side-effects от неиспользуемых модулей

**Решение:** Провести ревизию импортов, оставив только необходимые для каждого route-файла.

---

### 10. Тестовые файлы в корне проекта

**Файлы:** `test.js`, `test2.cjs`, `test3.ts`, `test4.cjs`, `test5.cjs`, `test6.cjs`, `test_logic.cjs`, `test_logic2.cjs`, `test_logic3.cjs`, `test_schedule.ts`

**Проблема:** 10 тестовых файлов лежат в корне репозитория, но не в `tests/` или `__tests__/` директории. Они не запускаются через `npm test`, содержат хардкод данных и потенциально чувствительную информацию.

**Решение:** Перенести в `tests/`, добавить в `.gitignore` если они только для локальной отладки, или удалить.

---

## 🟡 Рекомендации по улучшению

### 11. `package.json` — имя проекта `react-example`

**Файл:** [package.json:2](file:///c:/Users/User/antigravity/domru-integration/package.json#L2)

Имя `"react-example"` не отражает суть проекта. Рекомендую переименовать в `"domru-integration"` или `"domru-intercom"`.

---

### 12. Неиспользуемый пакет `@google/genai`

**Файл:** [package.json:14](file:///c:/Users/User/antigravity/domru-integration/package.json#L14)

Пакет `@google/genai` присутствует в зависимостях, но нигде не используется. Лишняя зависимость увеличивает Docker-образ и attack surface.

---

### 13. Отсутствие `.env` для конфигурации

Сейчас захардкожены значения вроде `"myhome_app"` / `"myhome_secret"` для OAuth Client ID/Secret ([Integrations.tsx](file:///c:/Users/User/antigravity/domru-integration/src/components/Integrations.tsx)). Стоит вынести все конфиг-значения в `.env` файл и загружать их через `dotenv`.

---

### 14. SIP-логи растут бесконечно в памяти

**Файл:** [sip-manager.ts:127](file:///c:/Users/User/antigravity/domru-integration/server/sip-manager.ts#L127)

Массив `sipLogs: SipLog[]` не имеет ограничения по размеру. При длительной работе сервера он будет бесконечно расти в памяти.

**Решение:** Ограничить длину массива, например `if (sipLogs.length > 500) sipLogs.shift();`

---

## 📊 Сводная таблица

| # | Проблема | Критичность | Сложность фикса |
|---|---------|-------------|----------------|
| 1 | Токены в URL query-параметрах | 🔴 Критическая | 🟡 Средняя |
| 2 | Глобальное отключение TLS | 🔴 Критическая | 🟢 Лёгкая |
| 3 | Нет Rate Limiting | 🔴 Критическая | 🟢 Лёгкая |
| 4 | CORS wildcard на WebSocket | 🔴 Критическая | 🟢 Лёгкая |
| 5 | Path Traversal в codeRoutes | 🔴 Критическая | 🟢 Лёгкая |
| 6 | Открытие двери без авторизации | 🟠 Серьёзная | 🟢 Лёгкая |
| 7 | Токены в plaintext на диске | 🟠 Серьёзная | 🟡 Средняя |
| 8 | Токены в логах | 🟠 Серьёзная | 🟢 Лёгкая |
| 9 | Избыточные импорты | 🟡 Улучшение | 🟡 Средняя |
| 10 | Тестовые файлы в корне | 🟡 Улучшение | 🟢 Лёгкая |
| 11 | Название проекта | 🟡 Улучшение | 🟢 Лёгкая |
| 12 | Неиспользуемый пакет genai | 🟡 Улучшение | 🟢 Лёгкая |
| 13 | Нет .env для конфигурации | 🟡 Улучшение | 🟢 Лёгкая |
| 14 | SIP-логи без лимита | 🟡 Улучшение | 🟢 Лёгкая |

---

## ⚡ Рекомендуемый порядок исправления

1. **Первая волна (быстрые фиксы, 1-2 часа):** Пункты 2, 3, 4, 5, 6, 8, 14
2. **Вторая волна (средние фиксы, 2-4 часа):** Пункты 1, 7, 9
3. **Третья волна (рефакторинг, 1 час):** Пункты 10, 11, 12, 13
