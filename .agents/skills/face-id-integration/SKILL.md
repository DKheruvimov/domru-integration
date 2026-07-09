---
name: face-id-integration
description: Инструкция по разработке и интеграции внешнего Python-модуля Face ID (dom-ru-eye) с ядром domru-integration.
---

# Интеграция dom-ru-eye (Face ID)

Эта инструкция предназначена для ИИ-агентов, которые будут переписывать и интегрировать проект `dom-ru-eye` (Python) в экосистему `domru-integration`.

## Основные правила архитектуры
1. **Разделение ответственности (UI vs Логика).** 
   Управление интерфейсом (тумблеры, загрузка фото, бейджики) обеспечивается ядром на основе конфигурации, которую передаёт модуль. Python-сервис занимается **исключительно** распознаванием и вообще не генерирует HTML/UI.
2. **Никакого кода Дом.ру во внешнем сервисе.** 
   Ядро (`domru-integration`) уже авторизовано в Дом.ру и умеет безопасно проксировать видео. Из Python-кода нужно **полностью удалить** любые скрипты авторизации, куки, `domru-js` и прямые обращения к серверам провайдера.
3. **Event-Driven (Lazy Loading).**
   Python-сервис не должен круглосуточно скачивать видео с камер. Распознавание запускается **только** по WebSocket-событию `incoming_call`.
4. **Безопасность (Токены).**
   Любое обращение к ядру происходит через добавление query-параметра `?token=MODULE_TOKEN`.

## Роль Ядра (UI и Хранилище)
Теперь ядро полностью универсально. В нём больше нет захардкоженного плагина Face ID. 
Чтобы в веб-интерфейсе появились тумблеры и аватарки, Python-сервис должен **явно зарегистрировать себя** при запуске. Ядро автоматически предоставляет универсальное хранилище для фото.

## Этапы работы Python-сервиса (dom-ru-eye)

### 1. Подключение и Регистрация UI
При старте Python-сервис делает запрос в ядро:
```http
POST http://localhost:3000/api/modules/actions/capabilities?token=MODULE_TOKEN
Content-Type: application/json

{
  "capability": "FACE_RECOGNITION",
  "label": "Face ID",
  "mediaEndpoint": "/api/modules/storage/ТВОЙ_MODULE_ID"
}
```
*Как только этот запрос выполнен, в карточках людей в React-интерфейсе появляются тумблеры Face ID и формы загрузки фото.*

### 2. Синхронизация базы лиц (Хранилище)
Пользователи загружают свои фотки через веб-интерфейс ядра. Ядро сохраняет их в универсальное модульное хранилище.
Python-сервису нужно:
- Запросить список людей: `GET http://localhost:3000/api/modules/actions/people?token=MODULE_TOKEN`
- Для каждого `personId`, у которого `pluginSettings.FACE_RECOGNITION === true`, скачать эталонное фото из хранилища: `GET http://localhost:3000/api/modules/actions/storage/{personId}?token=MODULE_TOKEN`.
- Обучить / загрузить эти лица в Qdrant / InsightFace.

### 2. Ожидание звонка (WebSocket)
Сервис подключается по WebSocket:
- URL: `ws://localhost:3000/modules?token=MODULE_TOKEN`
- Слушает событие `incoming_call`.
- Payload события содержит `{ deviceId, placeId, login }`.

### 3. Получение видео и Распознавание
Когда пришёл звонок:
- Сервис запрашивает локальную ссылку на видео: `GET http://localhost:3000/api/modules/actions/stream/{deviceId}?token=MODULE_TOKEN`
- Получает JSON с `hlsUrl` (например, `http://localhost:3000/api/domru/go2rtc-proxy/api/hls.m3u8?src=...`)
- Передаёт эту локальную ссылку в OpenCV / FFmpeg.
- Пытается найти лицо из загруженной ранее базы.

### 4. Команда на открытие двери
Если лицо найдено (например, узнали `personId: "user_123"`):
- Сервис делает POST-запрос:
  ```http
  POST http://localhost:3000/api/modules/actions/open?token=MODULE_TOKEN
  Content-Type: application/json

  {
    "deviceId": 123,
    "personId": "user_123",
    "capability": "FACE_RECOGNITION"
  }
  ```
- Ядро само проверит, не выключил ли пользователь тумблер Face ID в интерфейсе, подходит ли сейчас расписание и не исчерпаны ли лимиты гостя. Если всё ок — ядро откроет дверь.

## Что необходимо удалить из старого кода `dom-ru-eye`
- Файлы `.env.example` с логинами и паролями от Дом.ру (теперь нужен только `MODULE_TOKEN` и `CORE_URL`).
- `domru-js` или любые самописные парсеры API Дом.ру.
- Постоянный background-воркер, который стягивает кадры 24/7. Заменить на listener WebSockets.
