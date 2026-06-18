/**
 * Пример базового использования DomruClient.
 *
 * Запуск: bun run examples/basic-usage.ts
 */

import { DomruClient } from "../src/index.ts";

async function main() {
    // Создаём клиента
    const client = new DomruClient({
        login: "ваш_логин",
        password: "ваш_пароль",
        timeout: 10000,
        logger: {
            info: (msg) => console.log(`[инфо] ${msg}`),
            warn: (msg) => console.warn(`[предупреждение] ${msg}`),
            error: (msg) => console.error(`[ошибка] ${msg}`),
            debug: (msg) => console.debug(`[отладка] ${msg}`),
        },
    });

    // Подписываемся на события
    client.on("token:refreshed", ({ operatorId }) => {
        console.log(`Токен обновлён для оператора ${operatorId}`);
    });

    client.on("error", ({ error, context }) => {
        console.error(`Ошибка в ${context}: ${error.message}`);
    });

    // Аутентифицируемся
    await client.authenticate();
    console.log("Аутентификация успешна");

    // Получаем список объектов
    const places = await client.getSubscriberPlaces();
    console.log(`Найдено объектов: ${places.length}`);

    if (places.length > 0) {
        const placeId = places[0].place.id;

        // Получаем устройства (кешируется автоматически)
        const devices = await client.getDevices(placeId);
        console.log(`Найдено устройств: ${devices.length}`);

        if (devices.length > 0) {
            const device = devices[0];
            console.log(`Выбрано устройство: ${device.name}`);

            // Получаем URL видеопотока
            if (device.externalCameraId) {
                const stream = await client.getStreamUrl(device.externalCameraId);
                if (stream) {
                    console.log(`URL потока: ${stream.url}`);
                    console.log(`Тип потока: ${stream.type}`);
                }
            }

            // Получаем снимок
            const snapshot = await client.getSnapshot(placeId, device.id);
            if (snapshot) {
                console.log(`Снимок получен: ${snapshot.length} байт`);
            }

            // Открываем дверь
            const result = await client.openDoor(placeId, device.id);
            console.log(`Результат открытия двери: ${result.status ? "успешно" : "неудачно"}`);
        }
    }

    // Получаем баланс
    const finances = await client.getFinances();
    console.log(`Баланс: ${finances.balance} ₽`);
}

main().catch(console.error);
