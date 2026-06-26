export function getAppTimezone(): string {
  return localStorage.getItem("app_timezone") || "Europe/Moscow";
}

export function formatTimeInTimezone(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    const tz = getAppTimezone();
    return d.toLocaleTimeString("ru-RU", { ...options, timeZone: tz });
  } catch (e) {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    return d.toLocaleTimeString("ru-RU", options);
  }
}

export function formatDateInTimezone(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }
): string {
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    const tz = getAppTimezone();
    return d.toLocaleDateString("ru-RU", { ...options, timeZone: tz });
  } catch (e) {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    return d.toLocaleDateString("ru-RU", options);
  }
}
