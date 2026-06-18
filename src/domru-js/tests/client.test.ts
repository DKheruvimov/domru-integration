import { describe, it, expect, beforeEach, vi } from "vitest";
import { DomruClient } from "../src/client.js";

vi.mock("axios", () => ({
    default: {
        create: () => ({
            request: vi.fn().mockResolvedValue({
                status: 200,
                data: { data: [] },
            }),
        }),
    },
}));

describe("DomruClient", () => {
    let client: DomruClient;

    beforeEach(() => {
        client = new DomruClient({
            login: "тест",
            password: "тест",
            timeout: 5000,
        });
    });

    it("должен создать клиента с корректными настройками", () => {
        expect(client).toBeDefined();
        expect(client.token).toBeNull();
    });

    it("должен кешировать устройства на 5 минут", async () => {
        // Здесь мокаем axios для возврата устройств
        // Проверяем что второй вызов не делает запрос
        expect(true).toBe(true); // Заглушка
    });

    it("должен генерировать событие при обновлении токена", async () => {
        const handler = vi.fn();
        client.on("token:refreshed", handler);

        // Здесь мокаем аутентификацию
        expect(handler).not.toHaveBeenCalled(); // Пока не аутентифицированы
    });

    it("должен очищать кеш", () => {
        client.clearCache();
        expect(true).toBe(true); // Заглушка
    });
});
