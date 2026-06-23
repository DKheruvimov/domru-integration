import React from "react";
import { Blocks, MessageSquare, Copy, CheckCircle2 } from "lucide-react";
import { AppCredentials } from "../types";

interface IntegrationsProps {
  credentials: AppCredentials;
}

export default function Integrations({ credentials }: IntegrationsProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyableField = ({ label, value, id }: { label: string; value: string; id: string }) => (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-1.5">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-mono text-zinc-800 dark:text-zinc-200 truncate select-all">{value}</span>
        <button
          onClick={() => handleCopy(value, id)}
          className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0 cursor-pointer shadow-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-600"
          title="Скопировать"
        >
          {copiedField === id ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <Copy className="w-4 h-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8 animate-fade-in" id="integrations_panel">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-md">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-blue-500/10 rounded-2xl">
            <Blocks className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">Умный дом Яндекса</h2>
            <p className="text-sm font-medium text-zinc-500 mt-1">Открытие двери по кнопке или простой фразе ("Алиса, открой дверь")</p>
          </div>
        </div>
        
        <div className="mt-6 space-y-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
            1. Зайдите в <a href="https://dialogs.yandex.ru/developer/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Яндекс.Диалоги</a> и нажмите "Создать диалог" {"->"} "Умный дом".<br/>
            2. Заполните настройки навыка:
          </div>
          
          <div className="space-y-3 pt-2">
            <CopyableField label="Endpoint URL" value={window.location.origin + "/"} id="sh_endpoint" />
          </div>

          <div className="text-sm text-zinc-600 dark:text-zinc-400 font-bold pt-4">
            В разделе "Связка аккаунтов" (Account Linking):
          </div>

          <div className="space-y-3">
            <CopyableField label="Идентификатор приложения (Client ID)" value="myhome_app" id="sh_client_id" />
            <CopyableField label="Секрет приложения (Client secret)" value="myhome_secret" id="sh_client_secret" />
            <CopyableField label="URL авторизации (Authorization URL)" value={window.location.origin + "/oauth/authorize"} id="sh_auth_url" />
            <CopyableField label="URL для получения токена (Token URL)" value={window.location.origin + "/oauth/token"} id="sh_token_url" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-md">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-purple-500/10 rounded-2xl">
            <MessageSquare className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">Яндекс Диалоги (Авто-открытие)</h2>
            <p className="text-sm font-medium text-zinc-500 mt-1">Свободный диалог с Алисой для настройки ожидания курьера или гостей.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
            1. В <a href="https://dialogs.yandex.ru/developer/" target="_blank" rel="noreferrer" className="text-purple-500 hover:underline">Яндекс.Диалогах</a> нажмите "Создать диалог" {"->"} "Навык в Алисе".<br/>
            2. Укажите название (например, "Мой Домофон").<br/>
            3. Заполните технические настройки:
          </div>

          <div className="space-y-3 pt-2">
            <CopyableField label="Webhook URL" value={window.location.origin + "/api/yandex/dialogs"} id="dial_webhook" />
          </div>

          <div className="text-sm text-zinc-600 dark:text-zinc-400 font-bold pt-4">
            Включите "Связку аккаунтов" и используйте те же данные, что и в Умном Доме:
          </div>

          <div className="space-y-3">
            <CopyableField label="Идентификатор приложения (Client ID)" value="myhome_app" id="dial_client_id" />
            <CopyableField label="Секрет приложения (Client secret)" value="myhome_secret" id="dial_client_secret" />
            <CopyableField label="URL авторизации (Authorization URL)" value={window.location.origin + "/oauth/authorize"} id="dial_auth_url" />
            <CopyableField label="URL для получения токена (Token URL)" value={window.location.origin + "/oauth/token"} id="dial_token_url" />
          </div>

          <div className="mt-6 p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl">
            <h4 className="font-bold text-sm text-purple-700 dark:text-purple-400 mb-2">💡 Как использовать в сценариях</h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              Опубликуйте этот навык в <strong>Приватном доступе</strong>. В приложении "Дом с Алисой" создайте сценарии:
            </p>
            <ul className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium mt-2 space-y-2 list-disc list-inside">
              <li>Фраза: <em>"Жду курьера"</em> → Действие (Колонка): <em>"Попроси Мой Домофон ждать курьера"</em></li>
              <li>Фраза: <em>"Жду гостей"</em> → Действие (Колонка): <em>"Попроси Мой Домофон ждать гостей"</em></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
