import React, { useState } from "react";
import { AppCredentials } from "../types";
import { Key, User, ShieldCheck, Cpu, Code, MessageSquare, Phone, MapPin, ChevronRight, Lock, ArrowLeft } from "lucide-react";

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
    <div className="w-full max-w-md mx-auto animate-fade-in" id="login_form_container">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2rem] shadow-xl overflow-hidden p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-[#E30613]/10 dark:bg-[#E30613]/15 text-[#E30613] rounded-2xl mb-4">
            <Cpu className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-950 dark:text-white tracking-tight font-display">
            Dom.ru Proptech Client
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Интерактивный пульт управления умными устройствами
          </p>
        </div>

        {/* Sandbox vs Real API Toggle */}
        <div className="grid grid-cols-2 gap-3 mb-6 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
          <button
            type="button"
            className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              isDemo
                ? "bg-white dark:bg-zinc-700 text-[#E30613] dark:text-red-400 shadow-sm"
                : "text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
            onClick={() => {
              setIsDemo(true);
              handleResetSms();
            }}
            id="mode_demo_btn"
          >
            <Code className="w-3.5 h-3.5" />
            Песочница (Демо)
          </button>
          <button
            type="button"
            className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              !isDemo
                ? "bg-white dark:bg-zinc-700 text-[#E30613] dark:text-red-400 shadow-sm"
                : "text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
            onClick={() => {
              setIsDemo(false);
              handleResetSms();
            }}
            id="mode_real_btn"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Реальный API
          </button>
        </div>

        {/* Auth Method Toggle tabs */}
        <div className="grid grid-cols-2 gap-2 mb-6 border-b border-zinc-100 dark:border-zinc-805 pb-3">
          <button
            type="button"
            className={`py-1.5 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              authMethod === "password"
                ? "bg-red-500/5 dark:bg-red-500/10 text-[#E30613] dark:text-red-350 font-semibold shadow-2xs"
                : "text-zinc-550 hover:text-zinc-850 dark:hover:text-zinc-200"
            }`}
            onClick={() => {
              setAuthMethod("password");
              setError("");
            }}
            id="tab_password_btn"
          >
            <Key className="w-3.5 h-3.5" />
            По логину и паролю
          </button>
          <button
            type="button"
            className={`py-1.5 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              authMethod === "sms"
                ? "bg-red-500/5 dark:bg-red-500/10 text-[#E30613] dark:text-red-350 font-semibold shadow-2xs"
                : "text-zinc-550 hover:text-zinc-850 dark:hover:text-zinc-200"
            }`}
            onClick={() => {
              setAuthMethod("sms");
              handleResetSms();
            }}
            id="tab_sms_btn"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            По СМС коду
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 rounded-xl" id="auth_error_box">
            {error}
          </div>
        )}

        {/* --- METHOD: PASSWORD --- */}
        {authMethod === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {!isDemo && (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Логин или № Договора
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="79000000000"
                      className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-55 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E30613]/20 focus:border-[#E30613] text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Пароль
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E30613]/20 focus:border-[#E30613] text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              </>
            )}

            {isDemo ? (
              <div className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400 bg-red-50/40 dark:bg-red-950/10 border border-red-100/50 dark:border-red-900/20 rounded-xl px-4">
                ✨ Вы запускаете клиент в режиме имитации. Будут сгенерированы детальные тестовые адреса, домофоны и видеопотоки. Отличный вариант для быстрого знакомства с библиотекой!
              </div>
            ) : (
              <div className="py-4 text-xs text-zinc-500 dark:text-zinc-400 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/20 rounded-xl px-4 flex gap-2">
                ⚠️ Запросы к Dom.ru API выполняются через серверный HTTPS-прокси. Ваши пароли не логируются и используются только для прямой авторизации в Ertelecom.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#E30613] hover:bg-[#c20510] rounded-xl transition duration-150 disabled:opacity-50 shadow-md flex items-center justify-center font-display uppercase tracking-wider"
              id="login_submit_btn"
            >
              {loading ? "Аутентификация…" : isDemo ? "Запустить песочницу" : "Войти"}
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
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Номер мобильного телефона
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="79001234567"
                      className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E30613]/20 focus:border-[#E30613] text-zinc-900 dark:text-white"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
                    Введите 11 цифр номера, начиная с 7. Например, 79234567890
                  </p>
                </div>

                {isDemo && (
                  <div className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400 bg-red-50/40 dark:bg-red-950/10 border border-red-100/50 dark:border-red-900/20 rounded-xl px-4">
                    🛠️ Вы находитесь в демо-режиме (Имитация). Вы можете использовать любой тестовый телефон, чтобы воспроизвести шаги авторизации по СМС!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-[#E30613] hover:bg-[#c20510] rounded-xl transition duration-150 disabled:opacity-50 shadow-md flex items-center justify-center gap-2 font-display uppercase tracking-wider"
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
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                    id="sms_back_to_phone_btn"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    К вводу телефона
                  </button>
                  <span className="text-xs text-zinc-400 font-mono">
                    {phone}
                  </span>
                </div>

                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Выберите договор для входа:
                </label>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1" id="sms_accounts_list">
                  {smsAccounts.map((acc, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedAccount(acc)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                        selectedAccount?.accountId === acc.accountId
                          ? "border-teal-500 bg-teal-50/20 dark:bg-teal-950/20"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-900 dark:text-white leading-snug">
                            {acc.address}
                          </p>
                          <div className="flex justify-between items-center mt-2.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                            <span>Договор: <strong className="text-zinc-600 dark:text-zinc-300 font-mono">{acc.accountId}</strong></span>
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
                  className="w-full py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition duration-150 disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
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
                    className="text-xs text-[#E30613] dark:text-red-400 hover:underline flex items-center gap-1 font-semibold"
                    id="sms_reset_form_btn"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Начать заново
                  </button>
                  <span className="text-xs text-zinc-400 font-mono">
                    {phone}
                  </span>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl mb-4">
                  <div className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <MapPin className="w-4 h-4 text-[#E30613] shrink-0" />
                    <div>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">Адрес доставки кода:</p>
                      <p className="mt-0.5 line-clamp-2">{selectedAccount?.address}</p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                        № Договора: {selectedAccount?.accountId}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                    СМС-код подтверждения
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Введите 4-значный код"
                      className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E30613]/20 focus:border-[#E30613] text-zinc-900 dark:text-white font-mono tracking-widest text-center"
                    />
                  </div>
                  {isDemo ? (
                    <p className="text-[11px] text-[#E30613] dark:text-red-400 mt-2 text-center bg-[#E30613]/10 py-1.5 rounded-lg font-medium">
                      💡 В режиме Песочницы введите любой 4-значный код (например, 1234)
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
                      Введите код, полученный в СМС-сообщении на ваш мобильный телефон
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !otpCode}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-[#E30613] hover:bg-[#c20510] rounded-xl transition duration-150 disabled:opacity-50 shadow-md flex items-center justify-center font-display uppercase tracking-wider"
                  id="sms_confirm_submit_btn"
                >
                  {loading ? "Проверка…" : "Войти"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="text-center mt-6 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1">
        Разработано на базе <span className="font-mono text-[#E30613] dark:text-red-400 font-bold text-[11px]">S0yora/domru-js</span>
      </div>
    </div>
  );
}
