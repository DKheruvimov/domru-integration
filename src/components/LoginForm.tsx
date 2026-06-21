import React, { useState, useEffect } from "react";
import { AppCredentials } from "../types";
import { Key, User, ShieldCheck, Cpu, Code, MessageSquare, Phone, MapPin, ChevronRight, Lock, ArrowLeft, Home, Settings } from "lucide-react";

interface LoginFormProps {
  onLoginSuccess: (creds: AppCredentials) => void;
}

export interface SmsAccount {
  operatorId: number;
  subscriberId: number;
  accountId: string;
  placeId: number;
  address: string;
  profileId: string;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Режим входа: "password" | "sms"
  const [authMethod, setAuthMethod] = useState<"password" | "sms">("password");

  // Шаги для входа по СМС: "phone" (номер) -> "accounts" (выбор договора) -> "otp" (ввод кода)
  const [smsStep, setSmsStep] = useState<"phone" | "accounts" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [smsAccounts, setSmsAccounts] = useState<SmsAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SmsAccount | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // Автоматическое заполнение полей в режиме демо для удобства тестирования
  useEffect(() => {
    if (isDemo) {
      if (authMethod === "password") {
        setLogin("demo_user");
        setPassword("demo-password");
      } else {
        setPhone("79991234567");
      }
    } else {
      setLogin("");
      setPassword("");
      setPhone("");
    }
  }, [isDemo, authMethod]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isDemo) {
      onLoginSuccess({
        isDemo: true,
        login: "demo_user",
        token: "demo-token",
        operatorId: 123,
      });
      setLoading(false);
      return;
    }

    if (!login || !password) {
      setError("Укажите логин (телефон или № договора) и пароль!");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/domru/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-domru-login": login,
          "x-domru-password": password,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ошибка авторизации");
      }

      onLoginSuccess({
        login,
        password,
        token: data.token,
        operatorId: data.refreshData?.operatorId,
        refreshToken: data.refreshData?.refreshToken,
        isDemo: false,
      });
    } catch (err: any) {
      setError(err.message || "Не удалось связаться с сервером Dom.ru. Проверьте логин/пароль.");
    } finally {
      setLoading(false);
    }
  };

  // Шаг по СМС 1: Получение аккаунтов по номеру телефона
  const handleFetchSmsAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (cleanPhone.length !== 11) {
      setError("Номер телефона должен содержать ровно 11 цифр (например, 79234567890)");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/domru/sms/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-domru-demo": isDemo ? "true" : "false",
        },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось получить список аккаунтов");
      }

      if (!data || data.length === 0) {
        throw new Error("К данному номеру телефона не привязано ни одного договора Dom.ru");
      }

      setSmsAccounts(data);
      if (data.length === 1) {
        setSelectedAccount(data[0]);
      } else {
        setSelectedAccount(null);
      }
      setSmsStep("accounts");
    } catch (err: any) {
      setError(err.message || "Ошибка связи с сервером при получении аккаунтов.");
    } finally {
      setLoading(false);
    }
  };

  // Шаг по СМС 2: Запрос СМС кода на выбранный договор
  const handleRequestOtp = async () => {
    if (!selectedAccount) {
      setError("Выберите договор/адрес для отправки СМС-кода!");
      return;
    }

    setError("");
    setLoading(true);
    const cleanPhone = phone.trim().replace(/\D/g, "");

    try {
      const response = await fetch("/api/domru/sms/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-domru-demo": isDemo ? "true" : "false",
        },
        body: JSON.stringify({
          phone: cleanPhone,
          account: selectedAccount,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось отправить СМС-код");
      }

      setSmsStep("otp");
    } catch (err: any) {
      setError(err.message || "Ошибка отправки СМС.");
    } finally {
      setLoading(false);
    }
  };

  // Шаг по СМС 3: Подтверждение кода и вход в систему
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length === 0) {
      setError("Введите код подтверждения");
      return;
    }

    setError("");
    setLoading(true);
    const cleanPhone = phone.trim().replace(/\D/g, "");

    try {
      const response = await fetch("/api/domru/sms/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-domru-demo": isDemo ? "true" : "false",
        },
        body: JSON.stringify({
          phone: cleanPhone,
          code: otpCode.trim(),
          account: selectedAccount,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Неверный код подтверждения");
      }

      onLoginSuccess({
        login: cleanPhone,
        token: data.token,
        operatorId: data.refreshData?.operatorId,
        refreshToken: data.refreshData?.refreshToken,
        isDemo,
      });
    } catch (err: any) {
      setError(err.message || "Не удалось войти по СМС.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSms = () => {
    setSmsStep("phone");
    setSmsAccounts([]);
    setSelectedAccount(null);
    setOtpCode("");
    setError("");
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in px-3 sm:px-0" id="login_form_container">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800/80 rounded-[2rem] shadow-xl overflow-hidden p-6 sm:p-8">
        
        {/* Dom.ru Signature Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <div className="bg-[#E30613] w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-[#E30613]/25 transform hover:rotate-6 transition-all duration-300">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                <span className="font-display font-black text-2xl tracking-tighter text-zinc-900 dark:text-white">
                  дом
                </span>
                <span className="bg-[#E30613] text-white text-[13px] font-black px-2 py-0.5 rounded-full inline-flex items-center justify-center min-w-[28px] h-6 shadow-sm">
                  ru
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-extrabold uppercase tracking-widest block mt-0.5">
                Умный Дом
              </span>
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight font-display">
            Вход в личный кабинет
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium">
            Управление домофоном, камерами и услугами доступа
          </p>
        </div>

        {/* Auth Method Navigation Tabs */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full mb-6 border border-zinc-200/20 dark:border-zinc-700/30">
          <button
            type="button"
            className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
              authMethod === "sms"
                ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/15"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-250"
            }`}
            onClick={() => {
              setAuthMethod("sms");
              handleResetSms();
            }}
            id="tab_sms_btn"
          >
            По СМС-коду
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
              authMethod === "password"
                ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/15"
                : "text-zinc-550 hover:text-zinc-800 dark:hover:text-zinc-250"
            }`}
            onClick={() => {
              setAuthMethod("password");
              setError("");
            }}
            id="tab_password_btn"
          >
            По паролю
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 text-xs text-red-655 dark:text-red-400 rounded-2xl" id="auth_error_box">
            {error}
          </div>
        )}

        {/* --- METHOD: PASSWORD --- */}
        {authMethod === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                Логин или № Договора
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="79000000000 или 123456789"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/45 border border-zinc-200 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E30613]/15 focus:border-[#E30613] text-zinc-900 dark:text-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                Пароль
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/45 border border-zinc-200 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E30613]/15 focus:border-[#E30613] text-zinc-900 dark:text-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 text-xs font-bold text-white bg-[#E30613] hover:bg-[#c20510] active:scale-[0.98] rounded-full transition disabled:opacity-50 shadow-md shadow-[#E30613]/15 uppercase tracking-wider flex items-center justify-center gap-1.5"
              id="login_submit_btn"
            >
              {loading ? "Аутентификация…" : isDemo ? "Войти в демо-кабинет" : "Войти"}
            </button>
          </form>
        )}

        {/* --- METHOD: SMS FLOW --- */}
        {authMethod === "sms" && (
          <div className="space-y-4">
            {/* Step 1: Input Phone Number */}
            {smsStep === "phone" && (
              <form onSubmit={handleFetchSmsAccounts} className="space-y-4" id="sms_phone_step_form">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                    Номер мобильного телефона
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="79001234567"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/45 border border-zinc-200 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E30613]/15 focus:border-[#E30613] text-zinc-900 dark:text-white transition"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 font-medium">
                    Введите 11 цифр номера телефона, начиная с 7. Например, 79234567890
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 text-xs font-bold text-white bg-[#E30613] hover:bg-[#c20510] active:scale-[0.98] rounded-full transition disabled:opacity-50 shadow-md shadow-[#E30613]/15 uppercase tracking-wider flex items-center justify-center gap-2"
                  id="sms_find_contracts_btn"
                >
                  {loading ? "Поиск договоров…" : "Найти договоры"}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Step 2: Select associated contract */}
            {smsStep === "accounts" && (
              <div className="space-y-4" id="sms_accounts_step_layout">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={handleResetSms}
                    className="text-xs text-[#E30613] dark:text-red-400 hover:underline flex items-center gap-1 font-bold"
                    id="sms_back_to_phone_btn"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    К вводу телефона
                  </button>
                  <span className="text-xs text-zinc-400 font-mono font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                    {phone}
                  </span>
                </div>

                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  Выберите договор для входа:
                </label>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1" id="sms_accounts_list">
                  {smsAccounts.map((acc, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedAccount(acc)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition ${
                        selectedAccount?.accountId === acc.accountId
                          ? "border-[#E30613] bg-[#E30613]/5 dark:bg-[#E30613]/10"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/20 hover:bg-zinc-100/30 dark:hover:bg-zinc-800/30"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-[#E30613] mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm font-bold text-zinc-905 dark:text-white leading-snug">
                            {acc.address}
                          </p>
                          <div className="flex justify-between items-center mt-2.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                            <span>Договор: <strong className="text-zinc-700 dark:text-zinc-300 font-mono font-bold">{acc.accountId}</strong></span>
                            <span>ID: {acc.subscriberId}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loading || !selectedAccount}
                  className="w-full py-3 text-xs font-bold text-white bg-[#E30613] hover:bg-[#c20510] active:scale-[0.98] rounded-full transition disabled:opacity-50 shadow-md shadow-[#E30613]/15 uppercase tracking-wider flex items-center justify-center gap-2"
                  id="sms_request_code_btn"
                >
                  {loading ? "Отправка кода…" : "Отправить СМС-код"}
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 3: Enter Verification Code */}
            {smsStep === "otp" && (
              <form onSubmit={handleConfirmOtp} className="space-y-4" id="sms_otp_step_form">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={handleResetSms}
                    className="text-xs text-[#E30613] dark:text-red-400 hover:underline flex items-center gap-1 font-bold"
                    id="sms_reset_form_btn"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Начать заново
                  </button>
                  <span className="text-xs text-zinc-400 font-mono font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                    {phone}
                  </span>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl mb-4">
                  <div className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <MapPin className="w-4 h-4 text-[#E30613] shrink-0" />
                    <div>
                      <p className="font-bold text-zinc-800 dark:text-zinc-200">Адрес доставки кода:</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2">{selectedAccount?.address}</p>
                      <p className="mt-1 font-mono text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                        № Договора: {selectedAccount?.accountId}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                    СМС-код подтверждения
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Код из СМС"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-55 bg-zinc-50 dark:bg-zinc-800/45 border border-zinc-200 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E30613]/15 focus:border-[#E30613] text-zinc-900 dark:text-white font-mono tracking-widest text-center transition"
                    />
                  </div>
                  {isDemo ? (
                    <p className="text-[11px] text-[#E30613] dark:text-red-400 mt-2 text-center bg-[#E30613]/10 dark:bg-[#E30613]/15 py-2 rounded-xl font-semibold">
                      💡 В режиме Песочницы введите любой код (например, 1234)
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 font-medium">
                      Введите код, полученный в СМС-сообщении на ваш мобильный телефон
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !otpCode}
                  className="w-full py-3 text-xs font-bold text-white bg-[#E30613] hover:bg-[#c20510] active:scale-[0.98] rounded-full transition disabled:opacity-50 shadow-md shadow-[#E30613]/15 uppercase tracking-wider flex items-center justify-center"
                  id="sms_confirm_submit_btn"
                >
                  {loading ? "Проверка…" : "Войти в личный кабинет"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Collapsible Developer Panel Accordion */}
        <details className="mt-6 border-t border-zinc-100 dark:border-zinc-800 pt-4 group">
          <summary className="list-none flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer select-none">
            <span className="flex items-center gap-1.5 font-bold">
              <Settings className="w-3.5 h-3.5 group-open:rotate-45 transition-transform duration-300" />
              Параметры разработчика (Dev)
            </span>
            <span className="font-mono text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500">
              {isDemo ? "Песочница" : "Реальный API"}
            </span>
          </summary>
          
          <div className="mt-4 space-y-4 pt-1 animate-fade-in">
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider mb-2 ml-1">
                Подключение к API:
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-850 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsDemo(true);
                    handleResetSms();
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    isDemo
                      ? "bg-white dark:bg-zinc-700 text-[#E30613] shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
                  }`}
                >
                  Песочница (Демо)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDemo(false);
                    handleResetSms();
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    !isDemo
                      ? "bg-white dark:bg-zinc-700 text-[#E30613] shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
                  }`}
                >
                  Реальный API
                </button>
              </div>
            </div>

            <div className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
              {isDemo ? (
                <p>✨ Вы работаете в изолированной песочнице с эмулированными данными. Кабинет сгенерирует виртуальные домофоны и видеопотоки, не требуя реального контракта.</p>
              ) : (
                <p>⚠️ Запросы будут передаваться к реальному API провайдера Dom.ru (Эр-Телеком). Ваши учетные данные используются только для генерации сессионных OAuth-токенов.</p>
              )}
            </div>
          </div>
        </details>
      </div>

      <div className="text-center mt-6 text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1 font-medium">
        Разработано на базе <span className="font-mono text-[#E30613] dark:text-red-400 font-extrabold text-[11px]">S0yora/domru-js</span>
      </div>
    </div>
  );
}
