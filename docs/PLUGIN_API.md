# Plugin API — Справочник разработчика

> Версия API: **2.0** | Последнее обновление: 2026-07

Это технический референс по API, доступному при разработке плагинов для **Smart Intercom Hub**.  
Полный TypeScript-контракт — в файле [`plugins/plugin-api.d.ts`](../plugins/plugin-api.d.ts).

---

## Содержание

1. [Архитектура системы плагинов](#1-архитектура)
2. [Структура плагина](#2-структура-плагина)
3. [api.registerCapability()](#3-apiregistercapability)
4. [api.storage](#4-apistorage)
5. [api.router](#5-apirouter)
6. [api.onPersonLoad()](#6-apionpersonload)
7. [api.onEvaluateAutoOpen()](#7-apionevaluateautoopen)
8. [Расширение UI карточек (uiExtensions)](#8-расширение-ui-карточек)
9. [Пример плагина «с нуля»](#9-пример-плагина-с-нуля)

---

## 1. Архитектура

```
┌───────────────────────────────────┐
│          Ядро (Core)              │
│  ┌──────────────────────────┐     │
│  │     PluginManager        │     │
│  │  - loadPlugins()         │     │
│  │  - executePersonLoad()   │◄────┼── GET /api/people
│  │  - executeAutoOpen()     │◄────┼── incoming_call
│  └──────────┬───────────────┘     │
│             │ api: PluginAPI       │
└─────────────┼─────────────────────┘
              │
     ┌────────▼────────┐
     │   Плагин        │
     │   init(api)     │
     │                 │
     │  registerCap.   │  ──► Влияет на UI (переключатели в карточках)
     │  onPersonLoad   │  ──► Обогащает карточки данными и визуалом
     │  onEvalAutoOpen │  ──► Участвует в решении об открытии двери
     │  api.router     │  ──► Регистрирует HTTP-эндпоинты
     │  api.storage    │  ──► Сохраняет данные изолированно
     └─────────────────┘
```

Плагины **не могут** напрямую модифицировать БД ядра, обращаться к другим плагинам или встраивать произвольный HTML во фронтенд. Всё взаимодействие — через `PluginAPI`.

---

## 2. Структура плагина

```
plugins/
└── my-plugin/
    └── index.ts      ← точка входа (обязательно)
```

Точка входа должна экспортировать async-функцию `init` по умолчанию:

```typescript
import type { PluginAPI } from "../../server/plugin-manager.js";

export default async function init(api: PluginAPI): Promise<void> {
  // Инициализация плагина
}
```

---

## 3. api.registerCapability()

```typescript
api.registerCapability(capabilityName: string, config?: CapabilityConfig): void
```

Регистрирует «Возможность» — именованную функцию плагина, которую пользователь может включать/выключать **для каждой карточки отдельно** через UI.

### Параметры

| Параметр | Тип | Описание |
|---|---|---|
| `capabilityName` | `string` | Уникальный идентификатор в `UPPER_SNAKE_CASE` |
| `config.supportedRoles` | `Role[]` | Роли, для которых показывать переключатель. Если не указан — все роли. |

### Как это работает

1. Плагин вызывает `registerCapability("MY_CAP", { supportedRoles: ["resident"] })`.
2. Фронтенд запрашивает `GET /api/plugins/capabilities` и получает список всех возможностей.
3. В окне редактирования карточки **жильца** появляется переключатель «MY_CAP». У гостей и курьеров его нет.
4. Когда пользователь его включает, в `person.pluginSettings["MY_CAP"]` записывается `true`.
5. Плагин проверяет это в хуках: `person.pluginSettings?.MY_CAP`.

### Пример

```typescript
api.registerCapability("FACE_RECOGNITION", {
  supportedRoles: ["resident", "guest"] // курьеры исключены
});
```

---

## 4. api.storage

Изолированное key-value хранилище. Данные сохраняются в `data/plugins/<plugin-id>.json`.

```typescript
api.storage.get(key: string): Promise<any>
api.storage.set(key: string, value: any): Promise<void>
api.storage.delete(key: string): Promise<void>
api.storage.getAll(): Promise<Record<string, any>>
api.storage.clear(): Promise<void>
```

### Пример

```typescript
// Сохранить данные пользователя
await api.storage.set(person.id, { score: 0.97, lastSeen: Date.now() });

// Прочитать
const data = await api.storage.get(person.id);
console.log(data.score); // 0.97

// Получить всё (удобно для batch-операций в хуке)
const all = await api.storage.getAll();
// { "person-id-1": {...}, "person-id-2": {...} }

// Удалить запись (например, при удалении человека)
await api.storage.delete(person.id);
```

> **Совет:** В хуке `onPersonLoad` используйте `getAll()` один раз и обращайтесь к результату через индекс `all[p.id]`. Это намного эффективнее, чем вызывать `get()` для каждой карточки.

---

## 5. api.router

Express Router, смонтированный на `/api/plugins/<plugin-id>/`.

```typescript
api.router.get(path, handler)
api.router.post(path, handler)
api.router.put(path, handler)
api.router.delete(path, handler)
```

### Пример

```typescript
// Регистрируем GET /api/plugins/my-plugin/status
api.router.get("/status", (req, res) => {
  res.json({ status: "ok", pluginId: api.pluginId });
});

// Регистрируем POST /api/plugins/my-plugin/data/:personId
api.router.post("/data/:personId", async (req, res) => {
  const { personId } = req.params;
  await api.storage.set(personId, req.body);
  res.json({ success: true });
});
```

> Фронтенд вашего плагина (или внешний скрипт) может обращаться к этим эндпоинтам через стандартный `fetch`.

---

## 6. api.onPersonLoad()

```typescript
api.onPersonLoad(callback: (people: Person[]) => Promise<Person[]>): void
```

Хук вызывается каждый раз, когда фронтенд запрашивает список людей.  
Плагин получает полный массив карточек, может их обогатить данными из своего хранилища и **обязан вернуть массив** (изменённый или нет).

### Когда использовать

- Добавить в карточку данные из собственного хранилища (флаги, метрики, статусы).
- Настроить внешний вид карточки через [`uiExtensions`](#8-расширение-ui-карточек).

### Пример

```typescript
api.onPersonLoad(async (people) => {
  // Эффективно: загружаем всё одним запросом
  const myData = await api.storage.getAll();

  return people.map((p) => {
    const entry = myData[p.id];
    const isActive = !!p.pluginSettings?.MY_CAP;

    return {
      ...p,
      uiExtensions: {
        badges: isActive
          ? [{ label: "MY CAP", color: entry ? "success" : "warning" }]
          : [],
        avatarUrl: entry?.photoUrl ?? undefined,
      },
    };
  });
});
```

> **Важно:** Не изменяйте поля `person.id`, `person.role`, `person.schedules` — они управляются ядром.

---

## 7. api.onEvaluateAutoOpen()

```typescript
api.onEvaluateAutoOpen(
  callback: (person: Person, deviceId: number) => Promise<boolean | undefined>
): void
```

Хук вызывается при входящем звонке для каждого включённого человека, чьё расписание разрешает открытие (или у которого расписание выключено).

### Возвращаемые значения

| Значение | Действие |
|---|---|
| `true` | Плагин **разрешает** открытие. Дверь откроется. Цепочка останавливается. |
| `false` | Плагин **запрещает** открытие. Дверь не откроется. Цепочка останавливается. |
| `undefined` | Плагин **не принимает решение**. Передаёт управление следующему хуку или стандартной логике. |

Первый плагин, вернувший `true` или `false`, завершает обработку.

### Пример

```typescript
api.onEvaluateAutoOpen(async (person, deviceId) => {
  // Если для этого человека возможность не включена — не вмешиваемся
  if (!person.pluginSettings?.MY_CAP) return undefined;

  // Проверяем нашу логику
  const isVerified = await myVerificationLogic(person.id, deviceId);
  return isVerified; // true или false
});
```

---

## 8. Расширение UI карточек

Поле `person.uiExtensions` позволяет плагину изменять внешний вид карточки без модификации React-компонентов ядра. Заполняется в хуке `onPersonLoad`.

### Структура

```typescript
uiExtensions?: {
  avatarUrl?: string;
  badges?: Array<{
    label: string;
    color: "success" | "warning" | "error" | "neutral";
  }>;
  customBlocks?: Array<{
    title: string;
    status?: { label: string; color: BadgeColor };
    text?: string;
    subText?: string;
    imageUrl?: string;
  }>;
}
```

### avatarUrl

Заменяет стандартную иконку роли (жилец/гость/курьер) на изображение.  
URL должен быть доступен браузеру — используйте `api.router` для создания эндпоинта.

```typescript
uiExtensions: {
  avatarUrl: `/api/plugins/my-plugin/photo/${p.id}`
}
```

### badges

Небольшие цветные плашки рядом с именем.

```
[ Денис ]  [ ЖИЛЕЦ ]  [ FACE ID ✓ ]  [ MY CAP ⚠ ]
```

```typescript
uiExtensions: {
  badges: [
    { label: "Face ID", color: "success" },
    { label: "QR-пропуск", color: "warning" }
  ]
}
```

### customBlocks

Полноценные блоки под «Расписанием». Если расписание выключено — отображаются вместо него.

```
┌──────────────────────────────┐
│ МОЙ ПЛАГИН   [ АКТИВНО ]    │
│ ┌────┐ Основной текст       │
│ │ 📷 │ Дополнительный текст │
│ └────┘                      │
└──────────────────────────────┘
```

```typescript
uiExtensions: {
  customBlocks: [
    {
      title: "Журнал доступов",
      status: { label: "Активно", color: "success" },
      text: "Последний вход: Вчера в 18:30",
      subText: "Всего входов: 42",
      imageUrl: "/api/plugins/my-plugin/icon"
    }
  ]
}
```

---

## 9. Пример плагина «с нуля»

Простой плагин, который добавляет систему «доверенных устройств»:

```typescript
// plugins/trusted-devices/index.ts
import type { PluginAPI } from "../../server/plugin-manager.js";

export default async function init(api: PluginAPI): Promise<void> {
  // 1. Регистрируем возможность
  api.registerCapability("TRUSTED_DEVICE", {
    supportedRoles: ["resident"]
  });

  // 2. Добавляем HTTP-эндпоинт для управления данными
  api.router.post("/trust/:personId/:deviceId", async (req, res) => {
    const { personId, deviceId } = req.params;
    const trusted = await api.storage.get(personId) ?? [];
    if (!trusted.includes(Number(deviceId))) {
      trusted.push(Number(deviceId));
      await api.storage.set(personId, trusted);
    }
    res.json({ success: true, trusted });
  });

  // 3. Обогащаем карточки в UI
  api.onPersonLoad(async (people) => {
    const all = await api.storage.getAll();
    return people.map((p) => {
      const trusted: number[] = all[p.id] ?? [];
      const isEnabled = !!p.pluginSettings?.TRUSTED_DEVICE;

      return {
        ...p,
        uiExtensions: {
          badges: isEnabled
            ? [{ label: `Устройств: ${trusted.length}`, color: trusted.length > 0 ? "success" : "warning" }]
            : []
        }
      };
    });
  });

  // 4. Участвуем в решении об открытии
  api.onEvaluateAutoOpen(async (person, deviceId) => {
    if (!person.pluginSettings?.TRUSTED_DEVICE) return undefined;

    const trusted: number[] = await api.storage.get(person.id) ?? [];
    return trusted.includes(deviceId);
  });
}
```
