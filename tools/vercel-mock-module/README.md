# Vercel Mock Module

Это легковесный пример внешнего модуля, который можно мгновенно развернуть на Vercel (или другой Serverless платформе), чтобы протестировать получение вебхуков от Ядра.

## Как развернуть на Vercel

1. Убедитесь, что у вас установлен Vercel CLI: `npm i -g vercel`.
2. Находясь в этой папке (`tools/vercel-mock-module`), выполните команду:
   ```bash
   vercel
   ```
3. Прокликайте настройки по умолчанию (Enter, Enter, Enter).
4. Vercel выдаст вам Production URL (например, `https://vercel-mock-module-xyz.vercel.app`).
5. Ваш Webhook URL будет: `https://vercel-mock-module-xyz.vercel.app/api/webhook`.

## Как подключить к Ядру

1. Зайдите в интерфейс Домофона -> "Внешние модули".
2. Создайте новый модуль, скопируйте его Токен.
3. Отправьте POST запрос в Ядро, чтобы привязать ваш вебхук к этому токену:
   ```bash
   curl -X POST https://api.kheruvimov.ru/api/modules/actions/connection \
     -H "Authorization: Bearer ВАШ_ТОКЕН" \
     -H "Content-Type: application/json" \
     -d '{"type": "webhook", "webhookUrl": "https://ВАШ_ВЕРСЕЛ_УРЛ/api/webhook"}'
   ```
4. Теперь, при любых изменениях настроек в UI или при событиях вызова, Ядро будет отправлять POST-запросы на ваш Vercel!
5. Вы можете смотреть логи приходящих вебхуков прямо в дашборде Vercel (вкладка Logs).
