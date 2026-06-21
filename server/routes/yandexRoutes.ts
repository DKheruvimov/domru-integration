import express from "express";
import { registerCredentials } from "../tokenStore.js";
import { getRequestId, getProxiedStreamUrl } from "../yandexHelper.js";
import { getDomruInstanceFromToken, isDemo, MOCK_PLACES, MOCK_DEVICES, MOCK_CAMERAS } from "../domruClientHelper.js";

const router = express.Router();

// Register OAuth authorization credentials to get a short UUID code (prevents Yandex database truncation errors)
router.post("/oauth/register", (req, res) => {
  const creds = req.body;
  if (!creds || !creds.login) {
    return res.status(400).json({ error: "invalid_request", error_description: "Missing credentials" });
  }
  try {
    const code = registerCredentials(creds);
    res.json({ code });
  } catch (err: any) {
    console.error("[OAUTH_REGISTER] Failed to register credentials:", err);
    res.status(500).json({ error: "server_error", error_description: err.message });
  }
});

// Yandex OAuth2 Endpoint: Authorization Consent Page (serves premium UX in Russian with direct Demo mode option)
router.get("/oauth/authorize", (req, res) => {
  const clientId = req.query.client_id;
  const redirectUri = req.query.redirect_uri;
  const state = req.query.state;
  const responseType = req.query.response_type;

  if (!redirectUri) {
    return res.status(400).send("Bad request: missing redirect_uri");
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yandex Умный Дом — Авторизация Dom.ru/Forpost</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Inter", sans-serif; background-color: #09090b; color: #f4f4f5; }
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#121214] via-[#0d0d0f] to-[#121214]">
  <div class="w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-[2rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
    <!-- Red ambient backdrop -->
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#E30613]/10 rounded-full blur-3xl pointer-events-none"></div>

    <!-- Header info -->
    <div class="text-center mb-8 relative">
      <div class="w-16 h-16 bg-[#E30613] rounded-2xl flex items-center justify-center mx-auto mb-4 hover:scale-105 transition-transform shadow-lg shadow-[#E30613]/20">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8 text-white">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.02 5.912L12 16.5H9v3H6v-3l1.588-1.588A6.002 6.002 0 0115.75 5.25z" />
        </svg>
      </div>
      <h1 class="text-xl font-bold tracking-tight text-white mb-2">Связка с Алисой</h1>
      <p class="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">Подключите ваши умные домофоны и уличные камеры Forpost к Умному Дому Яндекса за несколько простых шагов.</p>
    </div>

    <!-- Custom Danger/Success Banner -->
    <div id="error-alert" class="hidden p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-400 text-xs mb-6 flex gap-2 items-start">
      <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span id="error-message">Произошла неизвестная ошибка. Пожалуйста, попробуйте снова.</span>
    </div>

    <!-- Tabs for selecting authentication method -->
    <div class="flex bg-black/40 p-1 rounded-2xl gap-1 mb-6 border border-zinc-800/60" id="auth-tabs">
      <button onclick="setAuthMethod('sms')" id="tab-sms" class="flex-1 py-3 text-sm font-semibold rounded-xl transition duration-200 text-white bg-[#E30613] shadow-md shadow-[#E30613]/10 cursor-pointer">
        По СМС
      </button>
      <button onclick="setAuthMethod('password')" id="tab-password" class="flex-1 py-3 text-sm font-semibold rounded-xl transition duration-200 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800/30">
        Договор и Пароль
      </button>
    </div>

    <!-- 1. Screen Enter Phone -->
    <div id="step1" class="space-y-5 animate-fade-in">
      <div>
        <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Ваш номер телефона</label>
        <div class="relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-sm">+7</span>
          <input type="tel" id="sms-phone" placeholder="999 123-4567" class="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#E30613]/20 focus:border-[#E30613] transition-all placeholder-zinc-700">
        </div>
      </div>
      
      <button onclick="handleGetAccounts()" id="btn-get-accounts" class="w-full bg-[#E30613] hover:bg-[#c20510] active:scale-[0.98] text-white text-sm font-semibold py-3 px-4 rounded-xl transition justify-center items-center flex gap-2 shadow-lg shadow-[#E30613]/10 cursor-pointer">
        <span>Проверить аккаунты</span>
        <svg id="spinner-get-accounts" class="w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>

      <div class="relative py-2 flex items-center justify-center">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-zinc-800"></div></div>
        <span class="relative bg-zinc-900 px-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Тестовый вход</span>
      </div>

      <button onclick="loginWithDemo()" class="w-full bg-zinc-950/80 hover:bg-zinc-900 text-zinc-300 hover:text-white active:scale-[0.98] text-xs font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 border border-zinc-800 border-dashed cursor-pointer">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Войти в режиме Демо (Для Модератора)</span>
      </button>
    </div>

    <!-- 4. Screen Password Login -->
    <div id="step-password" class="space-y-5 hidden animate-fade-in">
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Логин (№ договора или телефон)</label>
          <input type="text" id="pass-login" placeholder="Например, 520900240557" class="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#E30613]/20 focus:border-[#E30613] transition-all placeholder-zinc-700">
        </div>
        <div>
          <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Пароль</label>
          <input type="password" id="pass-password" placeholder="Введите пароль" class="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#E30613]/20 focus:border-[#E30613] transition-all placeholder-zinc-700">
        </div>
      </div>

      <button onclick="handlePasswordLogin()" id="btn-password-login" class="w-full bg-[#E30613] hover:bg-[#c20510] active:scale-[0.98] text-white text-sm font-semibold py-3 px-4 rounded-xl transition justify-center items-center flex gap-2 cursor-pointer shadow-lg shadow-[#E30613]/10">
        <span>Войти и связать аккаунт</span>
        <svg id="spinner-password-login" class="w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>

      <div class="relative py-2 flex items-center justify-center">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-zinc-800"></div></div>
        <span class="relative bg-zinc-900 px-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Тестовый вход</span>
      </div>

      <button onclick="loginWithDemo()" class="w-full bg-zinc-950/80 hover:bg-zinc-900 text-zinc-300 hover:text-white active:scale-[0.98] text-xs font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 border border-zinc-800 border-dashed cursor-pointer">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Войти в режиме Демо (Для Модератора)</span>
      </button>
    </div>

    <!-- 2. Screen Account Choose -->
    <div id="step2" class="space-y-5 hidden animate-fade-in">
      <div>
        <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Выберите договор / адрес</label>
        <div id="accounts-container" class="space-y-2.5 max-h-60 overflow-y-auto pr-1"></div>
      </div>

      <button onclick="handleSendSms()" id="btn-send-sms" class="w-full bg-[#E30613] hover:bg-[#c20510] active:scale-[0.98] text-white text-sm font-semibold py-3 px-4 rounded-xl transition justify-center items-center flex gap-2 cursor-pointer shadow-lg shadow-[#E30613]/10">
        <span>Выслать СМС код подтверждения</span>
        <svg id="spinner-send-sms" class="w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>

      <button onclick="goBackToStep1()" class="w-full bg-transparent hover:bg-zinc-850 text-zinc-400 hover:text-white text-xs font-semibold py-2.5 rounded-xl transition cursor-pointer border border-zinc-800">
        Изменить телефон
      </button>
    </div>

    <!-- 3. Screen Code SMS -->
    <div id="step3" class="space-y-5 hidden animate-fade-in">
      <div>
        <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">СМС код отправлен на +7<span id="label-target-phone"></span></label>
        <input type="text" id="sms-code" placeholder="Код" class="w-full bg-black/40 border border-zinc-800 rounded-xl py-3 text-center text-xl tracking-[0.6rem] font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#E30613]/25 focus:border-[#E30613] transition-all placeholder-zinc-700">
      </div>

      <button onclick="handleConfirmSms()" id="btn-confirm-sms" class="w-full bg-[#E30613] hover:bg-[#c20510] active:scale-[0.98] text-white text-sm font-semibold py-3 px-4 rounded-xl transition justify-center items-center flex gap-2 cursor-pointer shadow-lg shadow-[#E30613]/10">
        <span>Привязать аккаунт к Яндексу</span>
        <svg id="spinner-confirm-sms" class="w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>

      <button onclick="goBackToStep2()" class="w-full bg-transparent hover:bg-zinc-850 text-zinc-400 hover:text-white text-xs font-semibold py-2.5 rounded-xl transition cursor-pointer border border-zinc-800">
        Выбрать другой адрес
      </button>
    </div>
  </div>

  <script>
    let phoneVal = "";
    let accounts = [];
    let selectedAccountIndex = 0;
    let currentAuthMethod = "sms";

    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");
    const step3 = document.getElementById("step3");
    const stepPassword = document.getElementById("step-password");
    const authTabs = document.getElementById("auth-tabs");

    const phoneInput = document.getElementById("sms-phone");
    const smsCodeInput = document.getElementById("sms-code");

    const errorAlert = document.getElementById("error-alert");
    const errorMessage = document.getElementById("error-message");

    const urlParams = new URLSearchParams(window.location.search);
    const redirectUri = urlParams.get("redirect_uri");
    const stateVal = urlParams.get("state") || "";

    function showError(msg) {
      errorMessage.textContent = msg;
      errorAlert.classList.remove("hidden");
    }

    function clearError() {
      errorAlert.classList.add("hidden");
    }

    function toggleSpinner(id, isShow) {
      const spinner = document.getElementById(id);
      if (spinner) {
        if (isShow) spinner.classList.remove("hidden");
        else spinner.classList.add("hidden");
      }
    }

    function setAuthMethod(method) {
      clearError();
      currentAuthMethod = method;
      
      const tabSms = document.getElementById("tab-sms");
      const tabPassword = document.getElementById("tab-password");
      
      if (method === "sms") {
        tabSms.className = "flex-1 py-3 text-sm font-semibold rounded-xl transition duration-200 text-white bg-[#E30613] shadow-md shadow-[#E30613]/10 cursor-pointer";
        tabPassword.className = "flex-1 py-3 text-sm font-semibold rounded-xl transition duration-200 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800/30";
        
        stepPassword.classList.add("hidden");
        step1.classList.remove("hidden");
        step2.classList.add("hidden");
        step3.classList.add("hidden");
      } else {
        tabPassword.className = "flex-1 py-3 text-sm font-semibold rounded-xl transition duration-200 text-white bg-[#E30613] shadow-md shadow-[#E30613]/10 cursor-pointer";
        tabSms.className = "flex-1 py-3 text-sm font-semibold rounded-xl transition duration-200 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800/30";
        
        step1.classList.add("hidden");
        step2.classList.add("hidden");
        step3.classList.add("hidden");
        stepPassword.classList.remove("hidden");
      }
    }

    // Step 1: Query contracts lists
    async function handleGetAccounts() {
      clearError();
      const rawPhone = phoneInput.value.replace(/\D/g, "");
      if (!rawPhone || rawPhone.length < 10) {
        showError("Введите корректный номер телефона (например, +7 999 123-45-67).");
        return;
      }

      phoneVal = "7" + rawPhone.slice(-10);
      toggleSpinner("spinner-get-accounts", true);

      try {
        const res = await fetch("/api/domru/sms/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneVal })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Ошибка соединения с провайдером.");
        }

        accounts = await res.json();
        if (!accounts || accounts.length === 0) {
          throw new Error("Не найдено ни одного адреса на этот номер телефона.");
        }

        renderAccounts();
        
        if (authTabs) authTabs.classList.add("hidden");
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
      } catch (err) {
        showError(err.message);
      } finally {
        toggleSpinner("spinner-get-accounts", false);
      }
    }

    // Render Contracts
    function renderAccounts() {
      const container = document.getElementById("accounts-container");
      container.innerHTML = "";
      
      accounts.forEach((acc, idx) => {
        const checked = idx === 0 ? "checked" : "";
        const elem = document.createElement("label");
        elem.className = "flex items-start gap-3 p-4 bg-black/40 border border-zinc-800 rounded-xl cursor-pointer hover:border-[#E30613]/50 focus-within:border-[#E30613]/55 transition-all block relative select-none";
        elem.innerHTML = \`
          <input type="radio" name="selected_acc" value="\${idx}" \${checked} class="mt-1 accent-[#E30613] shrink-0">
          <div class="text-xs text-left">
            <p class="font-bold text-white mb-0.5 leading-tight">\${acc.address}</p>
            <p class="text-[10px] text-zinc-500">Договор: \${acc.accountId} | Провайдер ID \${acc.operatorId}</p>
          </div>
        \`;
        container.appendChild(elem);
      });
    }

    // Step 2: Send SMS Code
    async function handleSendSms() {
      clearError();
      const selectedRadio = document.querySelector("input[name='selected_acc']:checked");
      if (!selectedRadio) {
        showError("Пожалуйста, укажите хотя бы один договор.");
        return;
      }

      selectedAccountIndex = parseInt(selectedRadio.value, 10);
      const acc = accounts[selectedAccountIndex];

      toggleSpinner("spinner-send-sms", true);

      try {
        const res = await fetch("/api/domru/sms/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneVal, account: acc })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Не удалось выслать SMS код.");
        }

        document.getElementById("label-target-phone").textContent = phoneVal.slice(-10);
        step2.classList.add("hidden");
        step3.classList.remove("hidden");
      } catch (err) {
        showError(err.message);
      } finally {
        toggleSpinner("spinner-send-sms", false);
      }
    }

    // Step 3: Verify SMS
    async function handleConfirmSms() {
      clearError();
      const code = smsCodeInput.value.replace(/\D/g, "");
      if (!code || code.length !== 4) {
        showError("Длина проверочного СМС кода должна быть ровно 4 символа.");
        return;
      }

      const acc = accounts[selectedAccountIndex];
      toggleSpinner("spinner-confirm-sms", true);

      try {
        const res = await fetch("/api/domru/sms/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneVal, code: code, account: acc })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Неверный код СМС.");
        }

        const data = await res.json();
        
        // Successfully got token! Complete authentication back to Yandex webhook callback
        const finalCreds = {
          login: phoneVal,
          token: data.token,
          refreshToken: data.refreshData.refreshToken,
          operatorId: data.refreshData.operatorId,
          isDemo: false
        };

        completeYandexOAuth(finalCreds);
      } catch (err) {
        showError(err.message);
      } finally {
        toggleSpinner("spinner-confirm-sms", false);
      }
    }

    // Password-based Login Submit
    async function handlePasswordLogin() {
      clearError();
      const loginInput = document.getElementById("pass-login");
      const passwordInput = document.getElementById("pass-password");
      
      const loginValRaw = loginInput.value.trim();
      const passwordValRaw = passwordInput.value;
      
      if (!loginValRaw || !passwordValRaw) {
        showError("Пожалуйста, введите логин и пароль.");
        return;
      }
      
      toggleSpinner("spinner-password-login", true);
      
      try {
        const res = await fetch("/api/domru/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-domru-login": loginValRaw,
            "x-domru-password": passwordValRaw
          }
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Неверный логин или пароль.");
        }
        
        const data = await res.json();
        
        const finalCreds = {
          login: loginValRaw,
          password: passwordValRaw,
          token: data.token,
          refreshToken: data.refreshData.refreshToken,
          operatorId: data.refreshData.operatorId,
          isDemo: false
        };
        
        completeYandexOAuth(finalCreds);
      } catch (err) {
        showError(err.message);
      } finally {
        toggleSpinner("spinner-password-login", false);
      }
    }

    // Stateless Completion
    async function completeYandexOAuth(creds) {
      if (!redirectUri) {
        showError("Пожалуйста, откройте авторизацию через кабинет Яндекс Диалогов. Не передан redirect_uri.");
        return;
      }

      try {
        const registerRes = await fetch("/oauth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(creds)
        });
        if (!registerRes.ok) {
          throw new Error("Не удалось зарегистрировать авторизационную сессию на сервере.");
        }
        const regData = await registerRes.json();
        const code = regData.code;

        const finalUrl = redirectUri + "?code=" + code + "&state=" + encodeURIComponent(stateVal);
        window.location.href = finalUrl;
      } catch (err) {
        showError(err.message);
      }
    }

    // Demo Authentication trigger
    function loginWithDemo() {
      const demoCreds = {
        login: "demo_phone",
        token: "demo-access-token-123",
        refreshToken: "demo-refresh-token-456",
        operatorId: 123,
        isDemo: true
      };
      completeYandexOAuth(demoCreds);
    }

    // Nav Helpers
    function goBackToStep1() {
      if (authTabs) authTabs.classList.remove("hidden");
      step2.classList.add("hidden");
      step1.classList.remove("hidden");
    }

    function goBackToStep2() {
      step3.classList.add("hidden");
      step2.classList.remove("hidden");
    }
  </script>
</body>
</html>`;
  res.send(htmlContent);
});

// Yandex OAuth2 Endpoint: Token Exchange and Token Refresh
router.post("/oauth/token", (req, res) => {
  const grantType = req.body.grant_type;
  const code = req.body.code;
  const refreshToken = req.body.refresh_token;

  if (grantType === "authorization_code") {
    if (!code) {
      return res.status(400).json({ error: "invalid_request", error_description: "Missing authorization code" });
    }
    res.json({
      access_token: "at_" + code,
      refresh_token: "rt_" + code,
      expires_in: 31536000 // 1 year expiration
    });
  } else if (grantType === "refresh_token") {
    if (!refreshToken) {
      return res.status(400).json({ error: "invalid_request", error_description: "Missing refresh_token" });
    }
    const freshCode = refreshToken.startsWith("rt_") ? refreshToken.substring(3) : refreshToken;
    res.json({
      access_token: "at_" + freshCode,
      refresh_token: "rt_" + freshCode,
      expires_in: 31536000
    });
  } else {
    res.status(400).json({ error: "unsupported_grant_type" });
  }
});

// Yandex Provider Endpoint: Ping (Head or Get /v1.0)
router.get("/v1.0", (req, res) => {
  res.setHeader("X-Request-Id", getRequestId(req));
  res.sendStatus(200);
});
router.head("/v1.0", (req, res) => {
  res.setHeader("X-Request-Id", getRequestId(req));
  res.sendStatus(200);
});

// Yandex Provider Endpoint: Unlink Account webhook
router.post("/v1.0/user/unlink", (req, res) => {
  res.setHeader("X-Request-Id", getRequestId(req));
  res.json({
    request_id: getRequestId(req)
  });
});

// Yandex Provider Endpoint: Devices Discovery webhook
router.get("/v1.0/user/devices", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Request-Id", requestId);

  try {
    const { client, isDemo: isDemoMode, userId } = getDomruInstanceFromToken(req);

    let places: any[] = [];
    let devicesByPlace: { [key: number]: any[] } = {};
    let cameras: any[] = [];

    if (isDemoMode) {
      places = MOCK_PLACES;
      devicesByPlace = MOCK_DEVICES;
      cameras = MOCK_CAMERAS;
    } else {
      try {
        places = await client.getSubscriberPlaces();
        await Promise.all(
          places.map(async (place) => {
            const targetPlaceId = place.place?.id || place.id;
            try {
              const devs = await client.getDevices(targetPlaceId);
              devicesByPlace[targetPlaceId] = devs;
            } catch (err) {
              console.error(`Yandex recovery: failed to fetch devices for place ${targetPlaceId}:`, err);
              devicesByPlace[targetPlaceId] = [];
            }
          })
        );
        try {
          cameras = await client.getCameras();
          if (cameras.length > 0) {
            console.log("[DISCOVERY] Camera object sample keys:", Object.keys(cameras[0] as any).join(", "));
            console.log("[DISCOVERY] Camera[0] raw:", JSON.stringify(cameras[0]).substring(0, 300));
          }
        } catch (err) {
          console.error("Yandex recovery: failed to fetch cameras list:", err);
          cameras = [];
        }
      } catch (err: any) {
        console.error("Yandex dynamic discovery fetch error:", err);
        const isAuthError = err.name === "AuthRequiredError" || 
                            err.name === "UnauthorizedError" || 
                            err.message?.includes("Auth") || 
                            err.message?.includes("Unauthorized") || 
                            err.statusCode === 401 || 
                            err.statusCode === 403;
        
        if (isAuthError) {
          return res.status(401).json({
            request_id: requestId,
            error: "invalid_token"
          });
        }
        return res.status(500).json({
          request_id: requestId,
          error: "Failed to communicate with Domru API"
        });
      }
    }

    const yandexDevices: any[] = [];

    // Map Intercom / Door / Gate physical openers
    for (const place of places) {
      const targetPlaceId = place.place?.id || place.id;
      const devs = devicesByPlace[targetPlaceId] || [];
      const address = place.place?.address?.visibleAddress || `Договор ${targetPlaceId}`;

      for (const dev of devs) {
        const deviceId = `device_${targetPlaceId}_${dev.id}`;
        let yandexType = "devices.types.openable";

        if (dev.type === "camera") {
          yandexType = "devices.types.camera";
        }

        yandexDevices.push({
          id: deviceId,
          name: dev.name || "Домофон",
          description: `Адрес: ${address}`,
          type: yandexType,
          room: address,
          capabilities: [
            {
              type: "devices.capabilities.on_off",
              retrievable: true,
              parameters: {
                split: false
              }
            }
          ],
          device_info: {
            manufacturer: "Forpost / Dom.ru",
            model: dev.type || "intercom",
            hw_version: "1.0",
            sw_version: "1.0"
          }
        });
      }
    }

    // Map CCTV Security Cameras
    for (const cam of cameras) {
      const rawCamId = (cam as any).ID ?? (cam as any).id ?? (cam as any).cameraId ?? (cam as any).externalId;
      if (!rawCamId) {
        console.warn("[DISCOVERY] Camera skipped — no id field found. Keys:", Object.keys(cam as any).join(", "));
        continue;
      }
      const camId = `camera_${rawCamId}`;
      const camName = (cam as any).Name ?? (cam as any).name ?? "Камера";
      const address = "Видеонаблюдение";

      yandexDevices.push({
        id: camId,
        name: camName,
        description: "IP-камера безопасности Forpost",
        type: "devices.types.camera",
        room: address,
        capabilities: [
          {
            type: "devices.capabilities.video_stream",
            retrievable: false,
            parameters: {
              protocols: ["hls"],
              audio_supported: true
            }
          }
        ],
        device_info: {
          manufacturer: "Forpost / Dom.ru",
          model: "CCTV Camera",
          hw_version: "1.0",
          sw_version: "1.0"
        }
      });
    }

    res.json({
      request_id: requestId,
      payload: {
        user_id: userId,
        devices: yandexDevices
      }
    });

  } catch (err: any) {
    console.error("Yandex discovery failure:", err);
    res.status(401).json({ request_id: requestId, error: "invalid_token" });
  }
});

// Yandex Provider Endpoint: Query state webhook
router.post("/v1.0/user/devices/query", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Request-Id", requestId);

  try {
    const { client, isDemo: isDemoMode } = getDomruInstanceFromToken(req);
    const devices = req.body.devices;

    if (!devices || !Array.isArray(devices)) {
      return res.status(400).json({ request_id: requestId, error: "invalid_request" });
    }

    const resDevices: any[] = [];

    for (const reqDev of devices) {
      const devId = reqDev.id;

      if (devId.startsWith("camera_")) {
        resDevices.push({
          id: devId
        });
      } else if (devId.startsWith("device_")) {
        resDevices.push({
          id: devId,
          capabilities: [
            {
              type: "devices.capabilities.on_off",
              state: {
                instance: "on",
                value: false
              }
            }
          ]
        });
      }
    }

    res.json({
      request_id: requestId,
      payload: {
        devices: resDevices
      }
    });

  } catch (err: any) {
    console.error("Yandex state query error:", err);
    res.status(401).json({ request_id: requestId, error: "invalid_token" });
  }
});

// Yandex Provider Endpoint: Execute command webhook
router.post("/v1.0/user/devices/action", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Request-Id", requestId);

  console.log("[YANDEX_ACTION_REQ]", JSON.stringify(req.body, null, 2));

  try {
    const { client, isDemo: isDemoMode } = getDomruInstanceFromToken(req);
    const devices = req.body.payload?.devices;

    if (!devices || !Array.isArray(devices)) {
      return res.status(400).json({ request_id: requestId, error: "invalid_request" });
    }

    const resDevices: any[] = [];

    for (const reqDev of devices) {
      const devId = reqDev.id;
      const capabilities = reqDev.capabilities || [];
      const resCaps: any[] = [];

      for (const cap of capabilities) {
        if (cap.type === "devices.capabilities.video_stream" && cap.state?.instance === "get_stream") {
          const cameraId = devId.replace("camera_", "");
          let streamUrl = "";

          try {
            if (isDemoMode) {
              streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
            } else {
              const streamInfo = await client.getStreamUrl(cameraId);
              if (streamInfo?.url) {
                streamUrl = getProxiedStreamUrl(req, streamInfo.url, client);
              }
            }
          } catch (streamErr) {
            console.error(`[Yandex action] Failed to get stream for camera ${cameraId}:`, streamErr);
          }

          resCaps.push({
            type: "devices.capabilities.video_stream",
            state: {
              instance: "get_stream",
              action_result: { status: streamUrl ? "DONE" : "ERROR" },
              value: streamUrl ? { stream_url: streamUrl, protocol: "hls" } : undefined
            }
          });
          continue;
        }

        if (cap.type === "devices.capabilities.on_off") {
          const valve = cap.state?.value;
          let status = "DONE";
          let errCode = null;

          if (valve === true) {
            if (devId.startsWith("device_")) {
              const parts = devId.split("_");
              const placeId = Number(parts[1]);
              const deviceId = Number(parts[2]);

              if (!isDemoMode) {
                try {
                  await client.openDoor(placeId, deviceId);
                  console.log(`[Yandex Alice] Open door succeeded for place ${placeId}, device ${deviceId}`);
                } catch (errByDomru) {
                  console.error(`[Yandex Alice] Open door failed for place ${placeId}, device ${deviceId}:`, errByDomru);
                  status = "ERROR";
                  errCode = "DEVICE_UNREACHABLE";
                }
              } else {
                console.log(`[Yandex Alice Demo] Mock open command triggered for ${devId}`);
              }
            }
          }

          const capRes: any = {
            type: "devices.capabilities.on_off",
            state: {
              instance: "on",
              action_result: {
                status: status
              }
            }
          };

          if (errCode) {
            capRes.state.action_result.error_code = errCode;
          }

          resCaps.push(capRes);
        }
      }

      resDevices.push({
        id: devId,
        capabilities: resCaps
      });
    }

    const responsePayload = {
      request_id: requestId,
      payload: {
        devices: resDevices
      }
    };

    console.log("[YANDEX_ACTION_RES]", JSON.stringify(responsePayload, null, 2));
    res.json(responsePayload);

  } catch (err: any) {
    console.error("Yandex action failure:", err);
    res.status(401).json({ request_id: requestId, error: "invalid_token" });
  }
});

export default router;
