import { useState, useEffect } from "react";
import { AppCredentials } from "../types";
import {
  Copy,
  Check,
  Server,
  Link2,
  HelpCircle,
  RefreshCw,
  Key,
  Cpu,
  Layers,
  Settings,
  Shield,
  Smartphone,
  CheckCircle,
  Database,
  ArrowRight,
  Sparkles,
  Info
} from "lucide-react";

interface IntegrationsProps {
  credentials: AppCredentials;
}

export default function Integrations({ credentials }: IntegrationsProps) {
  const [domain, setDomain] = useState(() => {
    return localStorage.getItem("integration_domain") || "kheruvimov.ru";
  });
  
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem("integration_api_key") || "sk_domru_" + Math.random().toString(36).substring(2, 10);
  });

  const [testToken, setTestToken] = useState(() => {
    // Generate an automatic credentials token for previewing Yandex header format
    const sampleCreds = {
      login: credentials.login || "+79991234567",
      token: credentials.token || "demo-access-token-123",
      refreshToken: credentials.refreshToken || "demo-refresh-token-456",
      operatorId: credentials.operatorId || 123,
      isDemo: credentials.isDemo
    };
    try {
      const jsonStr = JSON.stringify(sampleCreds);
      return "at_" + btoa(unescape(encodeURIComponent(jsonStr)));
    } catch {
      return "at_demo-access-token-123";
    }
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Alice Simulator UI States
  const [simResults, setSimResults] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simStatusMsg, setSimStatusMsg] = useState("");

  useEffect(() => {
    localStorage.setItem("integration_domain", domain);
  }, [domain]);

  useEffect(() => {
    localStorage.setItem("integration_api_key", apiKey);
  }, [apiKey]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Alice Webhook Endpoints Builders
  const protocol = domain.includes("localhost") || domain.includes("127.0.0.1") ? "http" : "https";
  const endpointBase = `${protocol}://${domain}`;
  
  const yandexUrls = {
    discovery: `${endpointBase}/v1.0/user/devices`,
    query: `${endpointBase}/v1.0/user/devices/query`,
    action: `${endpointBase}/v1.0/user/devices/action`,
    auth: `${endpointBase}/oauth/authorize`,
    token: `${endpointBase}/oauth/token`,
    unlink: `${endpointBase}/v1.0/user/unlink`,
  };

  // Simulator to test GET /v1.0/user/devices locally or via the backend proxy
  const simulateDiscovery = async () => {
    setSimLoading(true);
    setSimStatusMsg("Отправка запроса авторизации...");
    
    try {
      const response = await fetch("/v1.0/user/devices", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${testToken}`,
          "X-Request-Id": "simulated-id-" + Math.floor(Math.random() * 100000)
        }
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setSimResults(data);
      setSimStatusMsg("Успешно получены данные от обработчика Yandex Smart Home!");
    } catch (e: any) {
      setSimStatusMsg(`Ошибка симуляции: ${e.message}`);
      setSimResults(null);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="integrations_panel">
      {/* Header section with badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-550/5 dark:bg-red-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#E30613]" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Интеграции умного дома</h1>
          </div>
          <p className="text-xs text-zinc-500 max-w-2xl">
            Настройте связывание вашего сервиса Dom.ru Proptech с системами голосовых ассистентов (Яндекс Алиса), Home Assistant, и получите готовые SDK/вебхук-ключи для размещения на домене <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono text-[11px] px-1 bg-zinc-100 dark:bg-zinc-800 rounded">{domain}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-3.5 py-2 rounded-2xl shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-mono">
            OAuth Gateway Live
          </span>
        </div>
      </div>

      {/* Grid of Main Configuration and Guides */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left column: Parameters & Domains Map (8 cols) */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8 min-w-0 w-full">
          
          {/* 1. Настройка домена и ключей */}
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-xs space-y-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-400" />
              <span>Глобальные параметры интеграции</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  Основной домен сервиса
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-zinc-400 text-xs">https://</span>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.replace(/https?:\/\//i, ""))}
                    placeholder="kheruvimov.ru"
                    className="w-full pl-18 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-zinc-800 dark:text-zinc-150 focus:outline-none focus:border-[#E30613]"
                  />
                </div>
                <p className="text-[10px] text-zinc-400">
                  Укажите ваш домен, на котором запущен контейнер. Мы обновим все ссылки автозаполнения для Яндекс Диалогов.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  Секретный токен API (Webhooks Key)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Key className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk_domru_..."
                    className="w-full pl-9 pr-10 py-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-zinc-800 dark:text-zinc-150 focus:outline-none focus:border-[#E30613]"
                  />
                  <button 
                    onClick={() => handleCopy(apiKey, "api_key")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-lg"
                    title="Скопировать"
                  >
                    {copiedField === "api_key" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Токен для безопасного вещания с внешними Home Assistant сборками и Node-RED (используйте в заголовке `Authorization`).
                </p>
              </div>
            </div>
          </div>

          {/* 2. Яндекс Диалоги: Ссылки и Настройки для привязки навыка */}
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4.5 h-4.5 text-[#E30613]" />
                <span>Эндпоинты Для Консоли Разработчика (Яндекс Диалоги)</span>
              </h2>
              <span className="px-2 py-0.5 bg-red-1050 border border-red-900/30 text-red-500 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                Yandex Smart Home Smart-Device V2
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Для связывания аккаунтов перейдите в <a href="https://dialogs.yandex.ru/developer/" target="_blank" rel="noreferrer" className="text-red-550 dark:text-red-400 inline-flex items-center gap-0.5 hover:underline font-medium">Консоль Яндекс Диалогов <ArrowRight className="w-3 h-3" /></a>, создайте тип диалога <b>«Умный дом»</b> и укажите следующие параметры во вкладке «Настройки»:
            </p>

            <div className="space-y-4">
              
              {/* Endpoint URL of skill content */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-805 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-[#E30613]/10 text-[#E30613] rounded font-bold uppercase tracking-wider">Webhook</span>
                    <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Адрес обработчика (Endpoint URL)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 tracking-wide font-mono select-all bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded inline-block">{endpointBase + "/"}</p>
                </div>
                <button
                  onClick={() => handleCopy(endpointBase + "/", "y_base")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-350 dark:hover:border-zinc-600 rounded-xl transition-all self-end md:self-auto cursor-pointer text-zinc-700 dark:text-zinc-200"
                >
                  {copiedField === "y_base" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === "y_base" ? "Скопировано!" : "Копировать"}</span>
                </button>
              </div>

              {/* OAuth Authorization URL */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-805 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded font-bold uppercase tracking-wider">OAuth AUTHORIZE</span>
                    <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Адрес авторизации</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 tracking-wide font-mono select-all bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded inline-block">{yandexUrls.auth}</p>
                </div>
                <button
                  onClick={() => handleCopy(yandexUrls.auth, "y_auth")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-350 dark:hover:border-zinc-600 rounded-xl transition-all self-end md:self-auto cursor-pointer text-zinc-700 dark:text-zinc-200"
                >
                  {copiedField === "y_auth" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === "y_auth" ? "Скопировано!" : "Копировать"}</span>
                </button>
              </div>

              {/* OAuth Token URL */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-805 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded font-bold uppercase tracking-wider">OAuth TOKEN</span>
                    <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Адреса токенов (Token / Refresh Token URL)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 tracking-wide font-mono select-all bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded inline-block">{yandexUrls.token}</p>
                </div>
                <button
                  onClick={() => handleCopy(yandexUrls.token, "y_token")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-350 dark:hover:border-zinc-600 rounded-xl transition-all self-end md:self-auto cursor-pointer text-zinc-700 dark:text-zinc-200"
                >
                  {copiedField === "y_token" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === "y_token" ? "Скопировано!" : "Копировать"}</span>
                </button>
              </div>

            </div>

             <div className="bg-zinc-50 dark:bg-zinc-800/40 p-5 border border-zinc-200/20 dark:border-zinc-800 rounded-2xl space-y-3">
              <span className="text-[11px] font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#E30613]" />
                Последовательность заполнения полей в Яндекс Диалогах:
              </span>
              <div className="text-xs space-y-2.5 text-zinc-500 dark:text-zinc-450">
                <p>
                  1. В разделе <b>Backend</b> выберите <b>Endpoint URL</b> и вставьте значение:
                  <br />
                  <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-300 select-all font-mono text-[11px]">{endpointBase}/</code>
                </p>
                <p>
                  2. В разделе <b>Тип доступа</b> выберите <b>Приватный</b>.
                </p>
                <p>
                  3. В разделе <b>Связка аккаунтов</b> включите опцию и укажите:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-1.5">
                  <li><b>Идентификатор приложения (Client ID):</b> любая произвольная строка (например, <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-300 font-mono text-[11px]">yandex-client-abc</code>)</li>
                  <li><b>Секрет приложения (Client Secret):</b> любая произвольная строка (например, <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-300 font-mono text-[11px]">yandex-secret-123</code>)</li>
                  <li><b>URL авторизации:</b> <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-300 font-mono text-[11px]">{yandexUrls.auth}</code></li>
                  <li><b>URL для получения токена:</b> <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-300 font-mono text-[11px]">{yandexUrls.token}</code></li>
                  <li><b>URL для обновления токена:</b> <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-300 font-mono text-[11px]">{yandexUrls.token}</code></li>
                  <li><b>Идентификатор группы действий:</b> оставьте пустым</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 3. Интерактивная Симуляция API Яндекс Smart Home */}
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-xs space-y-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4.5 h-4.5 text-indigo-500" />
              <span>Песочница и симуляция запроса от Умного Дома Яндекса</span>
            </h2>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Вы можете протестировать работоспособность функции обнаружения устройств (Discovery) вашего домофона прямо сейчас. Мы сгенерировали OAuth Bearer Token, содержащий данные вашего активного договора. Нажмите кнопку для имитации запроса Яндекса.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Симулируемый Bearer Token (автогенерация из сессии)
                </label>
                <div className="flex gap-2">
                   <input
                    type="text"
                    value={testToken}
                    onChange={(e) => setTestToken(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-mono text-zinc-600 dark:text-zinc-400 select-all focus:outline-none"
                  />
                  <button 
                    onClick={() => handleCopy(testToken, "test_token")}
                    className="p-2 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-xl"
                    title="Скопировать токен"
                  >
                    {copiedField === "test_token" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={simulateDiscovery}
                  disabled={simLoading}
                  className="px-5 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold text-xs rounded-xl flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${simLoading ? "animate-spin" : ""}`} />
                  <span>{simLoading ? "Симуляция..." : "Запустить Discovery (GET /v1.0/user/devices)"}</span>
                </button>
                
                {simResults && (
                  <button
                    onClick={() => setSimResults(null)}
                    className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                  >
                    Очистить вывод
                  </button>
                )}
              </div>

              {simStatusMsg && (
                <div className={`p-3 rounded-xl border text-xs flex gap-2 items-center ${
                  simStatusMsg.includes("Ошибка")
                    ? "bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400"
                    : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${simStatusMsg.includes("Ошибка") ? "bg-red-500" : "bg-emerald-500"}`} />
                  <span>{simStatusMsg}</span>
                </div>
              )}

              {simResults && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      Yandex JSON Response Payload
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      ContentType: application/json
                    </span>
                  </div>
                   <pre className="p-4 bg-zinc-950 text-emerald-400 text-[11px] font-mono rounded-2xl overflow-x-auto max-h-72 border border-zinc-800 shadow-inner">
                    {JSON.stringify(simResults, null, 2)}
                  </pre>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* Right column: Quick info cards & stats (4 cols) */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8 min-w-0 w-full">
          
          {/* Интеграция с Алисой: Шаги для обычного пользователя */}
          <div className="bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-xs space-y-6">
            <h2 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Пошаговый чеклист связывания</span>
            </h2>

            <div className="space-y-5">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E30613]/10 text-[#E30613] text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">Публикация Навыка</p>
                  <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Заполните метаданные в Яндекс Диалогах, сохраните изменения и отправьте навык на модерацию (или просто тестируйте в режиме разработчика под своим Яндекс-аккаунтом).
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E30613]/10 text-[#E30613] text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs">
                   <p className="font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">Привязка в Доме с Алисой</p>
                  <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Откройте приложение <b>«Дом с Алисой»</b> на телефоне. Нажмите <b>«+» → «Устройство умного дома»</b>, найдите ваш кастомный провайдер в списке и нажмите <b>«Привязать к Яндексу»</b>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E30613]/10 text-[#E30613] text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs">
                  <p className="font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">Подтверждение по СМС</p>
                  <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Откроется страница авторизации вашего сервиса (с поддержкой темы дизайна). Введите номер телефона, выберите нужный договор из привязанных к вашему договору Forpost, подтвердите СМС-кодом или войдите через Демо-режим.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E30613]/10 text-[#E30613] text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5">
                  4
                </div>
                <div className="text-xs">
                  <p className="font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">Голосовое управление!</p>
                  <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Всё готово! Теперь вы можете сказать: <code className="text-[#E30613] dark:text-red-400 font-semibold font-mono bg-[#E30613]/5 px-1 rounded">«Алиса, открой Домофон»</code> или автоматически просматривать трансляции с ваших камер на Яндекс Станции Макс или Смарт ТВ Yandex.
                  </p>
                </div>
              </div>
            </div>
          </div>

           {/* Безопасность и HTTPS */}
          <div className="bg-zinc-500/5 dark:bg-zinc-900/40 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-500" />
              Требования к безопасности
            </h3>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mr-0.5">✔</span>
                <span><b>HTTPS шифрование:</b> Яндекс работает только по безопасному SSL протоколу. Наличие действительного сертификата в Cloud Run обеспечивается автоматически.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mr-0.5">✔</span>
                <span><b>Статичная адресация:</b> Ваш домен <code>kheruvimov.ru</code> должен корректно перенаправлять трафик на шлюз.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mr-0.5">✔</span>
                <span><b>Stateless токены:</b> Токены авторизации шифруются по стандарту Base64 и не требуют СУБД для постоянной верификации, что позволяет осуществлять быстрые перезагрузки контейнеров.</span>
              </li>
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
}
