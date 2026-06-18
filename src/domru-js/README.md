# domru-js

Неофициальный TypeScript-клиент для API умного дома Dom.ru / Proptech: домофон, камеры, события, финансы и служебные данные.

> [!IMPORTANT]
> Проект не аффилирован с Dom.ru. Используйте на свой риск и храните учётные данные только в безопасном окружении.

[![npm downloads](https://img.shields.io/npm/dm/domru-js?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/domru-js)

## Что умеет клиент

- Аутентификация и автоматическое обновление токенов.
- Работа с объектами абонента и устройствами доступа.
- Получение видеопотоков камер (`HLS`, `MJPEG`, `RTSP`, `FLV`) и JPEG-снимков.
- Управление домофоном: удалённое открытие двери.
- Получение событий и временных кодов доступа.
- Финансовые данные по аккаунту.
- Встроенный EventEmitter и кеш запросов.

> [!TIP]
> `getDevices(placeId)` кешируется на 5 минут, что снижает лишние запросы к API.

## Установка

```bash
npm install domru-js
# или
bun add domru-js
# или
yarn add domru-js
```

## Быстрый старт

```ts
import { DomruClient } from "domru-js";

const client = new DomruClient({
	login: process.env.DOMRU_LOGIN,
	password: process.env.DOMRU_PASSWORD,
	timeout: 10_000,
});

await client.authenticate();

const places = await client.getSubscriberPlaces();
const placeId = places[0]?.place.id;

if (placeId) {
	const devices = await client.getDevices(placeId);
	const device = devices[0];

	if (device?.externalCameraId) {
		const stream = await client.getStreamUrl(device.externalCameraId);
		console.log("Stream URL:", stream?.url);
	}

	if (device) {
		const openResult = await client.openDoor(placeId, device.id);
		console.log("Door open:", openResult.status);
	}
}
```

## Конфигурация `DomruClient`

| Опция          | Тип           | Описание                                            |
| -------------- | ------------- | --------------------------------------------------- |
| `login`        | `string`      | Логин аккаунта                                      |
| `password`     | `string`      | Пароль аккаунта                                     |
| `refreshToken` | `string`      | Refresh-токен для восстановления сессии             |
| `operatorId`   | `number`      | ID оператора (если уже известен)                    |
| `timeout`      | `number`      | Таймаут HTTP-запросов в мс                          |
| `logger`       | `DomruLogger` | Кастомный логгер (`info`, `warn`, `error`, `debug`) |

> [!NOTE]
> Поля `login/password` и `refreshToken/operatorId` можно комбинировать в зависимости от сценария авторизации.

## События

```ts
client.on("token:refreshed", ({ operatorId }) => {
	console.log(`Token refreshed for operator ${operatorId}`);
});

client.on("camera:stream_changed", ({ cameraId, streamUrl }) => {
	console.log(`Camera ${cameraId} stream changed: ${streamUrl}`);
});

client.on("error", ({ error, context }) => {
	console.error(`Error in ${context}: ${error.message}`);
});
```

Поддерживаемые типы:

- `token:refreshed`
- `token:expired`
- `error`
- `rate_limit`
- `camera:stream_changed`

## API

| Метод                             | Возвращаемое значение              | Назначение                      |
| --------------------------------- | ---------------------------------- | ------------------------------- |
| `authenticate()`                  | `Promise<void>`                    | Явная авторизация клиента       |
| `getOperators()`                  | `Promise<Operator[]>`              | Список операторов               |
| `getSubscriberPlaces()`           | `Promise<SubscriberPlace[]>`       | Объекты абонента                |
| `getDevices(placeId)`             | `Promise<Device[]>`                | Устройства на объекте (с кешем) |
| `getCameras()`                    | `Promise<Camera[]>`                | Список камер                    |
| `getStreamUrl(cameraId)`          | `Promise<VideoStreamInfo \| null>` | Ссылка на видеопоток            |
| `getSnapshot(placeId, deviceId)`  | `Promise<Uint8Array \| null>`      | JPEG-снимок                     |
| `openDoor(placeId, deviceId)`     | `Promise<OpenResult>`              | Открытие двери                  |
| `getEvents(placeIds, page, sort)` | `Promise<DomruEvent[]>`            | История событий                 |
| `getTemporalCodes(deviceIds)`     | `Promise<TemporalCode[]>`          | Временные коды                  |
| `getFinances()`                   | `Promise<Finances>`                | Финансовая информация           |
| `clearCache()`                    | `void`                             | Полная очистка кеша             |
| `invalidateCache(placeId)`        | `void`                             | Точечная инвалидация кеша       |

## Публичные экспорты

Пакет экспортирует:

- `DomruClient`
- Событийные типы (`DomruEventType`, `DomruEventMap`, `EventHandler`)
- Интерфейсы API (`Device`, `Camera`, `DomruEvent`, `OpenResult`, `Finances` и др.)
- Ошибки (`DomruError`, `UnauthorizedError`, `ApiError` и др.)
- HTTP-абстракции (`HttpTransport`, `AxiosTransport`, `RequestCache`)

## Дисклеймер и ответственность

> [!WARNING]
> Автор и участники проекта **не несут ответственности** за любой прямой или косвенный ущерб, возникший при использовании `domru-js`.
>
> Проект создан исключительно для пользователей и команд, которые имеют **законные права и все необходимые разрешения** на доступ к аккаунтам, устройствам и видеопотокам Dom.ru.
>
> Любое применение библиотеки для несанкционированного доступа, слежки, шпионажа, обхода ограничений или иных противоправных действий строго запрещено и противоречит назначению проекта.

## Лицензия

MIT
