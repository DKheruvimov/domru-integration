# Архитектура проекта Dom.ru Integration

Данный документ описывает структуру и ключевые компоненты проекта для быстрой адаптации AI-агентов и новых контрибьюторов.

## Стек технологий

| Слой | Технологии |
|------|-----------|
| **Frontend** | React 19, TypeScript, Vite 6, Vanilla CSS, motion (Framer Motion), Lucide React, Socket.IO Client |
| **Backend (BFF)** | Node.js 20, Express 4, TypeScript, esbuild (сборка в CJS для продакшена) |
| **SIP/VoIP** | Библиотека `sip` (UDP), собственный SIP User-Agent для перехвата звонков домофона |
| **Видеостриминг** | go2rtc (WebRTC/HLS proxy daemon), FFmpeg (транскодирование аудио в AAC), hls.js (браузерный HLS-плеер) |
| **Real-time** | Socket.IO (WebSocket) — обновление состояния UI без polling |
| **Инфраструктура** | Docker (multi-stage build), Nginx (reverse proxy), Cloudflare/TurboFlare (CDN/DDoS protection) |

> [!NOTE]
> **О CSS**: Основной проект использует **Vanilla CSS** и библиотеку **motion** (Framer Motion) для анимаций. Tailwind CSS **не** используется в React-компонентах — он подключается **только** через CDN в standalone HTML-странице OAuth-авторизации (`server/views/oauth-consent.html`).

## Структура проекта

```
domru-integration/
├── server.ts                    # Точка входа: Express app, WS, go2rtc
├── server/                      # Бэкенд-логика
│   ├── config.ts                # Глобальные константы (PORT, HOST, DATA_DIR, tokenCache)
│   ├── ws-manager.ts            # WebSocket (Socket.IO) менеджер
│   ├── sip-manager.ts           # SIP User-Agent, авто-открытие, перехват звонков
│   ├── sip-init.ts              # Инициализация постоянных SIP-привязок при старте
│   ├── people-manager.ts        # Управление людьми, расписаниями, временными пропусками
│   ├── openings-manager.ts      # Журнал открытий дверей (manual/auto)
│   ├── snapshots-manager.ts     # Снапшоты камер при SIP-звонках
│   ├── settings-manager.ts      # Пользовательские настройки (задержки авто-открытия)
│   ├── tokenStore.ts            # Хранилище OAuth-токенов (UUID → credentials)
│   ├── go2rtc-manager.ts        # Управление go2rtc daemon (скачивание, запуск, WS-прокси)
│   ├── mpegTsParser.ts          # Парсер MPEG-TS для определения аудиокодеков в HLS
│   ├── domruClientHelper.ts     # Фабрика DomruClient, middleware авторизации, mock-данные
│   ├── yandexHelper.ts          # Хелперы для Yandex Smart Home (requestId, baseUrl, proxyUrl)
│   ├── types.ts                 # Реэкспорт SharedCredentials
│   ├── routes/                  # HTTP-маршруты (Express Router)
│   │   ├── domruRoutes.ts       # Фасад: собирает все sub-роутеры в /api/domru/*
│   │   ├── authRoutes.ts        # POST /login, /sms/request, /sms/confirm
│   │   ├── devicesRoutes.ts     # GET /places, /devices/:placeId, /cameras
│   │   ├── doorRoutes.ts        # POST /open, GET /snapshot, /sip/auto-open/status, POST /sip/auto-open
│   │   ├── streamRoutes.ts      # GET /stream-proxy/* — HLS прокси с FFmpeg транскодированием
│   │   ├── eventsRoutes.ts      # GET /events — история звонков, привязка к снапшотам
│   │   ├── peopleRoutes.ts      # CRUD /people — управление людьми и расписаниями
│   │   ├── snapshotsRoutes.ts   # GET/DELETE /snapshots — хранилище снапшотов
│   │   ├── settingsRoutes.ts    # GET/POST /settings — настройки приложения
│   │   ├── codeRoutes.ts        # GET /files, /file/:path — браузер исходного кода SDK
│   │   ├── yandexRoutes.ts      # OAuth flow + Yandex Smart Home endpoints
│   │   └── yandexDialogs.ts     # POST /api/yandex/dialogs — голосовые команды Алисы
│   └── views/
│       └── oauth-consent.html   # Страница согласия OAuth для Яндекс Smart Home
├── src/                         # Фронтенд (React)
│   ├── App.tsx                  # Главный компонент: роутинг Login → Dashboard
│   ├── main.tsx                 # Точка входа React
│   ├── socket.ts                # Singleton Socket.IO клиент
│   ├── types.ts                 # Фронтенд-типы (SmartPlace, SmartDevice, HistoryEvent, ...)
│   ├── index.css                # Глобальные стили
│   ├── components/
│   │   ├── LoginForm.tsx        # Форма авторизации (логин/пароль + SMS)
│   │   ├── Dashboard.tsx        # Основной layout: табы, мобильная/десктопная версия
│   │   ├── Integrations.tsx     # Страница интеграций (Yandex Smart Home, Dialogs)
│   │   ├── CodeBrowser.tsx      # Браузер исходного кода SDK
│   │   └── dashboard/
│   │       ├── DesktopDashboard.tsx  # Десктопный layout
│   │       ├── MobileDashboard.tsx   # Мобильный layout
│   │       ├── MyHomeView.tsx        # Вкладка «Мой дом»: камеры, устройства, открытие
│   │       ├── PeopleView.tsx        # Вкладка «Люди»: расписания, временные пропуска
│   │       ├── EventsView.tsx        # Вкладка «События»: история звонков
│   │       ├── StorageView.tsx       # Вкладка «Хранилище»: снапшоты камер
│   │       ├── SettingsView.tsx      # Вкладка «Настройки»: задержки, конфиг
│   │       ├── CctvPlayer.tsx        # Видеоплеер камер (HLS/WebRTC через go2rtc)
│   │       ├── SipLogsViewer.tsx     # Просмотр логов SIP-сессий
│   │       └── AutoOpenConfigModal.tsx  # Модальное окно настройки авто-открытия
│   ├── domru-js/                # SDK клиент для API Дом.ru
│   │   ├── client.ts            # Главный класс DomruClient
│   │   ├── index.ts             # Публичный API SDK
│   │   ├── context.ts           # Контекст сессии (токены, operatorId)
│   │   ├── constants.ts         # Базовые URL-ы API
│   │   ├── errors.ts            # Типизированные ошибки
│   │   ├── types.ts             # Типы SDK
│   │   ├── api/                 # Модули API
│   │   │   ├── places.ts        # Подписки и адреса
│   │   │   ├── cameras.ts       # Камеры
│   │   │   ├── events.ts        # История событий
│   │   │   ├── finances.ts      # Финансы аккаунта
│   │   │   ├── intercom.ts      # Открытие дверей
│   │   │   ├── operators.ts     # Список операторов
│   │   │   ├── sms-auth.ts      # Авторизация по SMS
│   │   │   └── stream.ts        # Видеопотоки и SIP credentials
│   │   └── http/                # HTTP-транспорт
│   │       ├── client.ts        # Базовый HTTP-клиент с авторефрешем токенов
│   │       ├── cache.ts         # Кеширование ответов
│   │       ├── transport.ts     # Абстракция транспорта
│   │       └── axios-transport.ts  # Реализация на Axios
│   └── lib/                     # Утилиты фронтенда
├── shared/
│   └── types.ts                 # Общие типы Frontend ↔ Backend (Person, ScheduleRule, SharedCredentials)
├── data/                        # Персистентные данные (примонтирован как Docker volume)
│   ├── tokens.json              # UUID → {login, token, refreshToken, operatorId, isDemo}
│   ├── people.json              # Массив Person[] (жильцы, гости, курьеры + расписания)
│   ├── openings.json            # Журнал открытий дверей (DoorOpeningRecord[])
│   ├── settings.json            # Пользовательские настройки (AppSettings)
│   ├── sip_tasks.json           # Активные SIP авто-открытия (AutoOpenTask[])
│   ├── snapshots.json           # Индекс снапшотов (SipSnapshotEntry[])
│   └── snapshots/               # JPEG-файлы снапшотов камер
└── docker-compose.yml           # Контейнеризация: порт 3100→3000, volume data/
```

## Ключевые компоненты

### 1. SDK (`src/domru-js/`)

Реализует REST-клиент к инфраструктуре Дом.ru (`myhome.proptech.ru`).

- **Авторизация**: строится на двух хэшах (SHA1 и MD5 с кастомной солью, захардкоженной в `http/client.ts`).
- **Сессия**: `accessToken` + `refreshToken` + `operatorId`. Автоматический рефреш при 401.
- **Кеширование**: встроенный кеш ответов (`http/cache.ts`) для снижения нагрузки.
- **EventEmitter**: отслеживание изменений токенов и ошибок.
- **API модули**: `places.ts` (подписки), `cameras.ts`, `events.ts`, `finances.ts`, `intercom.ts` (открытие дверей), `operators.ts`, `sms-auth.ts`, `stream.ts` (видеопотоки + SIP credentials).

### 2. Backend: маршруты (`server/routes/`)

Бэкенд декомпозирован на логические модули, объединённые через фасад `domruRoutes.ts`:

| Файл | Путь | Назначение |
|------|------|-----------|
| `authRoutes.ts` | `/login`, `/sms/*` | Авторизация, SMS-подтверждение |
| `devicesRoutes.ts` | `/places`, `/devices/:id`, `/cameras` | Места, устройства, камеры |
| `doorRoutes.ts` | `/open`, `/snapshot/*`, `/sip/auto-open/*` | Открытие дверей, снапшоты, управление авто-открытием |
| `streamRoutes.ts` | `/stream-proxy/*` | HLS-прокси с FFmpeg транскодированием (CORS bypass) |
| `eventsRoutes.ts` | `/events` | История звонков, привязка к снапшотам и журналу открытий |
| `peopleRoutes.ts` | `/people` | CRUD людей и расписаний, синхронизация с SIP-задачами |
| `snapshotsRoutes.ts` | `/snapshots` | Управление снапшотами камер |
| `settingsRoutes.ts` | `/settings` | Настройки приложения |
| `codeRoutes.ts` | `/code/*` | Браузер исходного кода SDK |
| `yandexRoutes.ts` | `/oauth/*`, `/v1.0/*` | OAuth flow + Yandex Smart Home |
| `yandexDialogs.ts` | `/api/yandex/dialogs` | Голосовые команды Алисы (Dialogs) |

> **Безопасность API:** Все приватные маршруты защищены middleware `requireDomruAuth`. Этот слой проверяет наличие валидных credentials в заголовках запроса и предотвращает неавторизованный доступ.

### 3. SIP Manager (`server/sip-manager.ts` + `server/sip-init.ts`)

Реализует перехват звонков домофона и функцию «Авто-открытие».

**Архитектура:**
- **Постоянные привязки** (`permanentBindings`): При старте сервера `sip-init.ts` перебирает все сохранённые аккаунты из `tokens.json`, запрашивает SIP-credentials для каждого устройства (кроме камер) и регистрирует их на SIP-сервере Дом.ru. Это позволяет серверу **слушать** входящие звонки для создания снапшотов камеры в момент звонка.
- **Активные задачи** (`activeTasks`): Когда пользователь включает авто-открытие (через UI или Алису), создаётся `AutoOpenTask`. При поступлении `INVITE` от SIP-сервера, если для данного логина есть активная задача, сервер отвечает `200 OK`, вызывает REST API для открытия двери, затем шлёт `BYE`.
- **Ручной перехват** (`ringingCalls`): Если активной задачи нет, но есть привязка, входящий звонок удерживается (`180 Ringing`) в течение 60 секунд. За это время пользователь может нажать «Открыть» в UI, и сервер ответит `200 OK` на существующий SIP-диалог.
- **Персистентность**: Активные задачи сериализуются в `data/sip_tasks.json` и восстанавливаются при перезапуске сервера.

**Интеграция с расписаниями:** При поступлении звонка SIP Manager проверяет расписания через `checkActiveSchedules()` из `people-manager.ts`. Если текущее время попадает в расписание жильца/гостя/курьера, дверь открывается автоматически с учётом настроенной задержки.

### 4. WebSocket Manager (`server/ws-manager.ts`)

Управляет real-time обновлениями UI через Socket.IO. **Категорически запрещено** использовать polling (`setInterval`) для обновления состояния — только WebSocket.

**Доступные события (сервер → клиент):**

| Событие | Функция broadcast | Когда срабатывает |
|---------|------------------|------------------|
| `auto_open_status_changed` | `broadcastAutoOpenStatusChanged()` | Изменение статуса авто-открытия (вкл/выкл тумблер, изменение расписания, истечение задачи) |
| `sip_log_added` | `broadcastSipLogAdded(log)` | Новая запись в SIP-логах |
| `sip_incoming_call` | `broadcastIncomingCall(login, details?)` | Входящий звонок в домофон |
| `door_opened` | `broadcastDoorOpened(deviceId, source, details)` | Дверь была открыта (любым способом) |
| `connected` | (при подключении) | Приветственное сообщение при установке WS-соединения |

**Клиентская часть** (`src/socket.ts`): Singleton-инстанс Socket.IO с автоматическим реконнектом.

### 5. Управление доступом и расписания (`server/people-manager.ts`)

Управляет списком доверенных лиц, регулярными расписаниями и временными пропусками.

- **Московское время (MSK, UTC+3)**: Все проверки `isScheduleActive()` нормализуются через `getMskTime()`, сдвигая время на UTC+3 независимо от системного часового пояса сервера.
- **Временные карты**: Создаются с префиксом `temp-{deviceId}`, полем `expiresAt` (UTC ms). В UI отображаются как «Сегодня».
- **Автоочистка**: `getPeople()` при каждом вызове удаляет просроченные временные карточки (`courier`/`guest` с `expiresAt < now`).
- **Ежедневный сброс курьеров**: Для роли `courier` с `maxOpens` поле `opensRemaining` сбрасывается до `maxOpens` при наступлении нового дня (MSK).
- **WebSocket синхронизация**: При сохранении изменений вызывается `broadcastAutoOpenStatusChanged()`.

### 6. Журнал открытий (`server/openings-manager.ts`)

Записывает каждое открытие двери (ручное или автоматическое) с привязкой к `placeId`, `deviceId`, типу (`manual`/`auto`) и описанию. Хранит записи за 30 дней. Используется `eventsRoutes.ts` для обогащения событий API Дом.ru информацией об источнике открытия (UI, Алиса, расписание, SIP).

### 7. Снапшоты камер (`server/snapshots-manager.ts`)

При каждом входящем SIP-звонке (`INVITE`) сервер автоматически делает снапшот камеры через API Дом.ru и сохраняет JPEG в `data/snapshots/`. Индекс хранится в `data/snapshots.json`. Снапшоты старше 30 дней автоматически удаляются. Привязка к событиям осуществляется через `findSnapshotForEvent()` с допуском ±15 минут.

### 8. Видеостриминг (`server/go2rtc-manager.ts` + `server/routes/streamRoutes.ts`)

**go2rtc**: Управляемый daemon для WebRTC/HLS проксирования видеопотоков. Бинарник автоматически скачивается при первом запуске. Предоставляет WebRTC-транспорт для low-latency просмотра камер. WebSocket-подключения к go2rtc проксируются через Express на пути `/api/go2rtc/ws`.

**FFmpeg Video Proxy** (`streamRoutes.ts`): Обходит CORS-ограничения и проксирует HLS-потоки камер. Определяет наличие аудиодорожки через `mpegTsParser.ts` и при необходимости транскодирует аудио в AAC через FFmpeg для совместимости с браузерами и плеером Яндекса.

### 9. Интеграция с Яндекс

**Smart Home** (`yandexRoutes.ts`):
- OAuth2 flow: `/oauth/authorize` (consent page) → `/oauth/register` (регистрация credentials) → `/oauth/token` (выдача access/refresh токенов).
- Endpoints: `/v1.0/user/devices` (список устройств как замков/камер), `/v1.0/user/devices/action` (открытие двери), `/v1.0/user/devices/query` (статус устройств).
- Камеры транслируются Яндексу через проксированные HLS URL.

**Dialogs / Алиса** (`yandexDialogs.ts`):
- Обрабатывает голосовые команды: «Жду курьера» (1 открытие на 2 часа), «Жду N гостей» (N открытий на 3 часа).
- Использует Account Linking для авторизации (тот же OAuth flow).
- Создаёт SIP-задачу (`enableAutoOpen`) и визуальную карточку в People (`addTemporaryAutoOpenPerson`).

### 10. Сетевая инфраструктура и развертывание

- **Docker**: Multi-stage build (builder → runtime с Alpine + FFmpeg). Порт `3000` внутри контейнера, маппится на `3100` на хосте.
- **Nginx**: Reverse proxy с поддержкой WebSocket (`Upgrade`), таймаутами для видеопотоков (86400s). Конфигурация в `nginx-domru.conf`.
- **Reverse Proxy** (Cloudflare/TurboFlare): `app.set("trust proxy", true)` для корректного определения IP клиентов.
- **Обход WAF для Яндекса**: При использовании защищенных CDN/WAF-прокси (например, TurboFlare) все запросы Яндекса (OAuth, Webhooks, Discovery) должны маршрутизироваться через отдельный субдомен (например, `oauth.yourdomain.ru`), настроенный в DNS напрямую на IP-адрес сервера (в обход WAF-защиты), чтобы избежать ложных срабатываний Open Redirect и User-Agent блокировок. Nginx на сервере конфигурируется для прослушивания обоих доменных имен.
- **Ограничение**: Reverse proxy защищает только входящий трафик. Исходящий трафик к API Дом.ru идёт с реального IP сервера.

### 11. Общие типы (`shared/types.ts`)

Мост типизации между Frontend и Backend:
- `SharedCredentials` — учётные данные пользователя
- `Person` — карточка человека (жилец/гость/курьер)
- `ScheduleRule` — правило расписания (дни недели, время начала/конца)

Обе стороны импортируют типы из `shared/types.ts`, что гарантирует синхронизацию контрактов.

## Соглашения о написании кода

- Строгая типизация во всём проекте (TypeScript). Минимизировать использование `any`.
- **CSS**: Vanilla CSS + motion (Framer Motion). Tailwind CDN только в `oauth-consent.html`.
- **Модальные окна**: Только кастомные React-компоненты (AnimatePresence + motion.div). Нативные `window.confirm()`/`window.alert()` запрещены (iFrame sandbox).
- **Real-time**: Только WebSocket (Socket.IO). Polling через `setInterval` запрещён.
- **Время**: Всегда MSK (UTC+3) через `getMskTime()`. Нативные `getHours()`/`getDay()` без нормализации запрещены.
- **Анонимизация**: Личные домены запрещены. Использовать `yourdomain.com`.
- Коммиты и комментарии пишутся в соответствии с задачами.
