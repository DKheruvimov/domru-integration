import React from "react";
import { Blocks, MessageSquare, Copy, CheckCircle2, ExternalLink, HelpCircle } from "lucide-react";
import { AppCredentials } from "../types";

interface IntegrationsProps {
  credentials: AppCredentials;
}

export default function Integrations({ credentials }: IntegrationsProps) {
  const [activeTab, setActiveTab] = React.useState<"smarthome" | "dialogs">("smarthome");
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyableField = ({ label, value, id }: { label: string; value: string; id: string }) => (
    <div className="space-y-1.5" id={`field_${id}`}>
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none">
          {label}
        </label>
        {copiedField === id && (
          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider animate-fade-in leading-none">
            Скопировано!
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-3.5 py-2.5 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition">
        <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate select-all flex-1">
          {value}
        </span>
        <button
          onClick={() => handleCopy(value, id)}
          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shrink-0 cursor-pointer rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Скопировать в буфер"
        >
          {copiedField === id ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-6 animate-fade-in" id="integrations_panel">
      
      {/* Intro Header */}
      <div className="p-4 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200/40 dark:border-zinc-800/50 rounded-2xl">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
          Интеграция с сервисами Яндекса позволяет управлять домофоном голосом через умные колонки с Алисой, добавлять его в сценарии умного дома или настраивать автоматическое открытие двери для гостей и курьеров.
        </p>
      </div>

      {/* Internal Tabs - Styled EXACTLY like the main dev-tools tabs */}
      <div className="flex bg-zinc-150/80 dark:bg-zinc-800/80 p-0.5 rounded-xl gap-0.5 border border-zinc-200/40 dark:border-zinc-800/60 max-w-md select-none">
        <button
          onClick={() => setActiveTab("smarthome")}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap px-4 text-center ${
            activeTab === "smarthome"
              ? "bg-white dark:bg-zinc-750 text-[#e30613] shadow-xs border border-zinc-200/20 dark:border-zinc-700/25"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          Умный дом Яндекса
        </button>
        <button
          onClick={() => setActiveTab("dialogs")}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap px-4 text-center ${
            activeTab === "dialogs"
              ? "bg-white dark:bg-zinc-750 text-[#e30613] shadow-xs border border-zinc-200/20 dark:border-zinc-700/25"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          Навык Алисы
        </button>
      </div>

      {/* Tab 1: Yandex Smart Home */}
      {activeTab === "smarthome" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Card */}
          <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0 mt-0.5">
                <Blocks className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
                  Голосовое открытие («Алиса, открой дверь»)
                </h4>
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-normal">
                  Позволяет добавить домофон в приложение «Дом с Алисой» как замок/дверь умного дома для быстрого открытия с экрана телефона или через колонку.
                </p>
              </div>
            </div>
          </div>

          {/* Steps & Content */}
          <div className="space-y-5">
            <h5 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block leading-none">
              Пошаговое руководство по настройке
            </h5>

            <div className="space-y-4.5 pl-1">
              
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">1</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                    Перейдите в кабинет разработчика и нажмите <strong>«Создать диалог»</strong> → выберите <strong>«Умный дом»</strong>.
                  </p>
                  <a
                    href="https://dialogs.yandex.ru/developer/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#e30613] hover:underline"
                  >
                    Открыть Яндекс.Диалоги <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">2</span>
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Задайте название (например, <em>«Умный домофон»</em>), выберите категорию и укажите следующий технический адрес обработчика:
                </p>
              </div>

              {/* Copyable endpoint */}
              <div className="pl-8">
                <CopyableField 
                  label="Endpoint URL" 
                  value={window.location.origin + "/api/yandex/smart-home"} 
                  id="sh_endpoint" 
                />
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">3</span>
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Прокрутите форму до раздела <strong>«Связка аккаунтов» (Account Linking)</strong>, включите её и заполните параметры авторизации приложения:
                </p>
              </div>

              {/* Copyable OAuth Params */}
              <div className="pl-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CopyableField label="Идентификатор приложения (Client ID)" value="myhome_app" id="sh_client_id" />
                  <CopyableField label="Секрет приложения (Client Secret)" value="myhome_secret" id="sh_client_secret" />
                </div>
                <CopyableField
                  label="URL авторизации (Authorization URL)"
                  value={window.location.origin + "/oauth/authorize"}
                  id="sh_auth_url"
                />
                <CopyableField
                  label="URL для получения токена (Token URL)"
                  value={window.location.origin + "/oauth/token"}
                  id="sh_token_url"
                />
                <CopyableField
                  label="URL для обновления токена (Refresh URL)"
                  value={window.location.origin + "/oauth/token"}
                  id="sh_refresh_url"
                />
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">4</span>
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Скопируйте поле <strong>«Redirect URI»</strong> со стороны Яндекса и убедитесь, что оно совпадает с официальным брокером авторизации Яндекса:
                </p>
              </div>

              <div className="pl-8">
                <CopyableField
                  label="Яндекс Redirect URI"
                  value="https://social.yandex.net/broker/redirect"
                  id="sh_redirect_uri"
                />
              </div>

              {/* Step 5 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">5</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                    Нажмите <strong>«Сохранить»</strong> и отправьте на модерацию (для приватных навыков она проходит мгновенно).
                  </p>
                </div>
              </div>

              {/* Step 6 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">6</span>
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Откройте приложение <strong>«Дом с Алисой»</strong> на смартфоне, перейдите в <strong>Добавить устройство → Умное устройство</strong>, найдите своего провайдера и авторизуйтесь под демо-аккаунтом (Логин: <code>demo</code>).
                </p>
              </div>

            </div>
          </div>

          {/* Usage Alert Box */}
          <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/20 rounded-2xl space-y-1.5">
            <h5 className="font-extrabold text-[10px] text-blue-750 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> 💡 Примеры голосовых команд
            </h5>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-semibold">
              После успешной настройки вы сможете отдавать команды вашим колонкам Яндекс.Станция или мобильной Алисе:
            </p>
            <ul className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium pl-1.5 space-y-1">
              <li className="flex items-center gap-1.5">
                <span className="text-blue-500 font-bold">•</span>
                <em>«Алиса, открой дверь в подъезде»</em>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-blue-500 font-bold">•</span>
                <em>«Алиса, впусти гостей»</em>
              </li>
            </ul>
          </div>

        </div>
      )}

      {/* Tab 2: Yandex Dialogs (Conversational Skill) */}
      {activeTab === "dialogs" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Card */}
          <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl shrink-0 mt-0.5">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
                  Авто-открытие при звонке («Жду курьера»)
                </h4>
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-normal">
                  Диалоговый навык позволяет Алисе принимать голосовые сценарии авто-открытия домофона при первом звонке (например, ожидание курьера или гостей на заданный период времени).
                </p>
              </div>
            </div>
          </div>

          {/* Steps & Content */}
          <div className="space-y-5">
            <h5 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block leading-none">
              Инструкция по настройке навыка
            </h5>

            <div className="space-y-4.5 pl-1">
              
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">1</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                    В кабинете разработчика выберите <strong>«Создать диалог»</strong> → выберите тип <strong>«Навык в Алисе»</strong>.
                  </p>
                  <a
                    href="https://dialogs.yandex.ru/developer/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#e30613] hover:underline"
                  >
                    Открыть Яндекс.Диалоги <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">2</span>
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Задайте активационное имя (например, <em>«мой домофон»</em> или <em>«умный консьерж»</em>) и вставьте адрес Webhook обработчика:
                </p>
              </div>

              {/* Copyable Webhook URL */}
              <div className="pl-8">
                <CopyableField 
                  label="Webhook URL" 
                  value={window.location.origin + "/api/yandex/dialogs"} 
                  id="dial_webhook" 
                />
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">3</span>
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Для авторизации настройте связку аккаунтов (Account Linking) точно так же, как и для первого навыка Умного Дома:
                </p>
              </div>

              {/* Copyable OAuth Parameters duplicated for convenience */}
              <div className="pl-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CopyableField label="Идентификатор приложения (Client ID)" value="myhome_app" id="dial_client_id" />
                  <CopyableField label="Секрет приложения (Client Secret)" value="myhome_secret" id="dial_client_secret" />
                </div>
                <CopyableField
                  label="URL авторизации (Authorization URL)"
                  value={window.location.origin + "/oauth/authorize"}
                  id="dial_auth_url"
                />
                <CopyableField
                  label="URL для получения токена (Token URL)"
                  value={window.location.origin + "/oauth/token"}
                  id="dial_token_url"
                />
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">4</span>
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Завершите настройку, нажав <strong>«Сохранить»</strong> и опубликовав диалог в приватном или общем доступе.
                </p>
              </div>

            </div>
          </div>

          {/* Scenarios configuration help */}
          <div className="p-4 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/10 dark:border-purple-500/20 rounded-2xl space-y-3">
            <h5 className="font-extrabold text-[10px] text-purple-750 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
              🚀 Как настроить короткие команды (через Сценарии)
            </h5>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-semibold">
              Чтобы не произносить длинные фразы (например, <em>«Алиса, попроси умный домофон ждать курьера»</em>), можно создать сценарий в приложении Умного дома:
            </p>
            
            <div className="space-y-3 pl-1">
              <div className="flex items-start gap-2.5">
                <span className="text-xs font-black text-purple-500 shrink-0 mt-0.5">1.</span>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  В приложении <strong>«Умный дом с Алисой»</strong> нажмите плюсик (+) и выберите <strong>«Сценарий»</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-xs font-black text-purple-500 shrink-0 mt-0.5">2.</span>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Условие <strong>«Если»</strong> → <strong>Фраза</strong>. Напишите короткую команду, например: <em className="bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Жду курьера</em>
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-xs font-black text-purple-500 shrink-0 mt-0.5">3.</span>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Действие <strong>«Тогда»</strong> → Выберите колонку → <strong>Выполнить команду</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-xs font-black text-purple-500 shrink-0 mt-0.5">4.</span>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 leading-relaxed">
                  Напишите полную команду запуска: <em className="bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-purple-600 dark:text-purple-400">Попроси [Имя навыка] ждать курьера</em>. Сохраните.
                </p>
              </div>
            </div>

            <div className="mt-2 bg-white/55 dark:bg-zinc-900/45 p-3 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 text-[11px] text-zinc-650 dark:text-zinc-350">
              <span className="font-bold text-zinc-800 dark:text-zinc-200">Как это работает:</span> Когда вы скажете <em>«Алиса, жду курьера»</em>, сработает сценарий и Алиса "про себя" выполнит длинную команду, вызвав ваш навык.
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
