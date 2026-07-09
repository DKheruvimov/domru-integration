/**
 * Smart Intercom Hub — Plugin API Type Declarations
 *
 * Этот файл описывает контракт API, доступного плагину при инициализации.
 * Используйте `import type { PluginAPI } from "../plugin-api"` в своём плагине
 * или просто импортируйте из `"../../server/plugin-manager.js"`.
 *
 * @version 2.0
 */

// ─────────────────────────────────────────────────────────────────────────────
// Типы данных ядра
// ─────────────────────────────────────────────────────────────────────────────

export type Role = "resident" | "guest" | "courier";
export type BadgeColor = "success" | "warning" | "error" | "neutral";

export interface ScheduleRule {
  id: string;
  /** 0 = Вс, 1 = Пн, ..., 6 = Сб */
  days: number[];
  startTime: string; // "18:00"
  endTime: string;   // "19:00"
}

/**
 * Объект человека, как он хранится в ядре.
 * Плагин получает его в хуках и может дополнять поля.
 */
export interface Person {
  id: string;
  name: string;
  role: Role;
  enabled: boolean;
  schedules: ScheduleRule[];
  maxOpens?: number | null;
  opensRemaining?: number | null;
  lastOpenedDate?: string | null;
  expiresAt?: number | null;
  useSchedule?: boolean;
  /** Настройки, которые пользователь включил для этого человека через UI.
   *  Ключ — название capability, зарегистрированного плагином. */
  pluginSettings?: Record<string, boolean>;

  // ── Поля, которые плагин может добавлять/изменять в onPersonLoad ──────────

  /** [Устаревшее] Было добавлено плагином Face ID. Предпочтительно использовать uiExtensions. */
  hasFacePhoto?: boolean;

  /**
   * Расширения UI. Плагин заполняет этот объект в хуке `onPersonLoad`,
   * чтобы ядро динамически изменило внешний вид карточки.
   */
  uiExtensions?: PersonUIExtensions;
}

/** Описывает, как плагин хочет изменить внешний вид карточки человека. */
export interface PersonUIExtensions {
  /**
   * Если указан — заменяет стандартную иконку-заглушку аватара
   * (квадрат с закруглёнными углами) на изображение по этому URL.
   * URL должен быть доступен браузеру клиента — используйте `api.router`
   * для раздачи собственных эндпоинтов.
   */
  avatarUrl?: string;

  /**
   * Массив небольших цветных бейджей, которые отображаются
   * в шапке карточки рядом с именем и ролью.
   */
  badges?: Array<{
    label: string;
    color: BadgeColor;
  }>;

  /**
   * Массив полноценных блоков, которые отображаются под блоком «Расписание».
   * Если расписание выключено и есть хотя бы один customBlock —
   * блок-разделитель появится вместо расписания.
   * Каждый блок может содержать заголовок, статус-бейдж, текст и/или изображение.
   */
  customBlocks?: Array<{
    /** Заголовок блока (аналог «РАСПИСАНИЕ», «FACE ID» и т.д.) */
    title: string;
    /** Опциональный статусный бейдж рядом с заголовком */
    status?: { label: string; color: BadgeColor };
    /** Основной текст внутри блока */
    text?: string;
    /** Дополнительный мелкий текст */
    subText?: string;
    /** URL изображения-миниатюры внутри блока (например, фото лица) */
    imageUrl?: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Хранилище плагина
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Изолированное key-value хранилище для данных плагина.
 * Данные хранятся в `data/plugins/<plugin-id>.json`.
 * Каждый плагин имеет доступ ТОЛЬКО к своему пространству имён.
 */
export interface PluginStorage {
  /** Прочитать значение по ключу. */
  get(key: string): Promise<any>;
  /** Записать/обновить значение по ключу. */
  set(key: string, value: any): Promise<void>;
  /** Удалить запись по ключу. */
  delete(key: string): Promise<void>;
  /** Получить все записи в виде объекта { ключ: значение }. */
  getAll(): Promise<Record<string, any>>;
  /** Полностью очистить хранилище плагина. */
  clear(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Конфигурация возможности (Capability)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Конфигурация, передаваемая при регистрации Capability.
 * Управляет тем, для каких ролей фронтенд будет показывать
 * переключатели данной возможности в карточке.
 */
export interface CapabilityConfig {
  /**
   * Список ролей, для которых плагин поддерживает данную возможность.
   * Если не указан — возможность применима ко всем ролям.
   * Пример: ["resident", "guest"] исключит курьеров.
   */
  supportedRoles?: Role[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin API — главный контракт
// ─────────────────────────────────────────────────────────────────────────────

import type { Router } from "express";

/**
 * Объект API, который ядро передаёт в функцию `init(api)` плагина.
 * Все взаимодействия плагина с системой происходят через этот объект.
 */
export interface PluginAPI {
  /** Уникальный идентификатор плагина (имя папки в /plugins). */
  pluginId: string;

  /**
   * Изолированное хранилище данных плагина.
   * @see PluginStorage
   */
  storage: PluginStorage;

  /**
   * Express Router, смонтированный по пути `/api/plugins/<plugin-id>/`.
   * Используйте для регистрации HTTP-эндпоинтов плагина.
   *
   * @example
   * api.router.get("/status", (req, res) => res.json({ ok: true }));
   * // Доступен по GET /api/plugins/my-plugin/status
   */
  router: Router;

  /**
   * Регистрирует «Возможность» плагина.
   * Фронтенд запрашивает список возможностей и автоматически:
   * - показывает переключатель в карточке для поддерживаемых ролей
   * - позволяет пользователю включить/выключить функцию для конкретного человека
   * Состояние переключателей хранится в `person.pluginSettings[capabilityName]`.
   *
   * @param capabilityName - Уникальное имя в UPPER_SNAKE_CASE (например, "FACE_RECOGNITION")
   * @param config - Конфигурация с ограничениями по ролям
   *
   * @example
   * api.registerCapability("FACE_RECOGNITION", {
   *   supportedRoles: ["resident", "guest"]
   * });
   */
  registerCapability(capabilityName: string, config?: CapabilityConfig): void;

  /**
   * Хук загрузки карточек.
   * Вызывается каждый раз, когда фронтенд запрашивает список людей.
   * Плагин получает массив объектов Person, может дополнить их
   * данными из своего хранилища и должен вернуть изменённый массив.
   *
   * Именно здесь нужно заполнять `person.uiExtensions`, чтобы изменить
   * внешний вид карточек (аватар, бейджи, блоки).
   *
   * @param callback - Асинхронная функция-трансформер.
   *
   * @example
   * api.onPersonLoad(async (people) => {
   *   const myData = await api.storage.getAll();
   *   return people.map(p => ({
   *     ...p,
   *     uiExtensions: {
   *       badges: myData[p.id]
   *         ? [{ label: "Активен", color: "success" }]
   *         : []
   *     }
   *   }));
   * });
   */
  onPersonLoad(callback: (people: Person[]) => Promise<Person[]>): void;

  /**
   * Хук решения об авто-открытии двери.
   * Вызывается при входящем звонке, ПОСЛЕ стандартной проверки расписания,
   * для каждого включённого человека.
   *
   * Возвращаемое значение:
   * - `true`      — плагин РАЗРЕШАЕТ открытие (дверь откроется)
   * - `false`     — плагин ЗАПРЕЩАЕТ открытие (дверь не откроется, проверка останавливается)
   * - `undefined` — плагин не принимает решение, передаёт управление следующему хуку
   *
   * Первый плагин, вернувший `true` или `false`, завершает цепочку.
   *
   * @param callback - Асинхронная функция-решатель.
   *
   * @example
   * api.onEvaluateAutoOpen(async (person, deviceId) => {
   *   if (!person.pluginSettings?.MY_CAPABILITY) return undefined;
   *   const isVerified = await checkSomething(person.id, deviceId);
   *   return isVerified; // true откроет дверь, false заблокирует
   * });
   */
  onEvaluateAutoOpen(
    callback: (person: Person, deviceId: number) => Promise<boolean | undefined>
  ): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Точка входа плагина
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Каждый плагин должен экспортировать функцию `init` по умолчанию.
 * Ядро вызывает её при запуске, передавая объект `PluginAPI`.
 *
 * @example
 * // plugins/my-plugin/index.ts
 * import type { PluginAPI } from "../plugin-api";
 *
 * export default async function init(api: PluginAPI): Promise<void> {
 *   api.registerCapability("MY_FEATURE", { supportedRoles: ["resident"] });
 *   api.onPersonLoad(async (people) => people); // passthrough
 * }
 */
export type PluginInitFn = (api: PluginAPI) => Promise<void> | void;
