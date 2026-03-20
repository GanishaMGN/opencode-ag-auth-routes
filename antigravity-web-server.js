const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execSync, spawn } = require("node:child_process");

const HOST = process.env.AG_WEB_HOST || "127.0.0.1";
const PORT = Number(process.env.AG_WEB_PORT || 4876);
const CONFIG_DIR = __dirname;
const CURRENT_CONFIG_PATH = path.join(CONFIG_DIR, "antigravity.json");
const STABLE_CONFIG_PATH = path.join(CONFIG_DIR, "antigravity.stable.json");
const TURBO_CONFIG_PATH = path.join(CONFIG_DIR, "antigravity.turbo.json");
const OPENCODE_CONFIG_PATH = path.join(CONFIG_DIR, "opencode.json");
const ACCOUNTS_PATH = path.join(CONFIG_DIR, "antigravity-accounts.json");
const HTML_PATH = path.join(CONFIG_DIR, "antigravity-web.html");

const CHATGPT_MODEL_TEMPLATES = {
  "gpt-5.3-codex": {
    name: "GPT-5.3 Codex",
    limit: { context: 400000, output: 65536 },
    modalities: { input: ["text", "image"], output: ["text"] },
  },
  "gpt-4.1": {
    name: "GPT-4.1",
    limit: { context: 1048576, output: 65536 },
    modalities: { input: ["text", "image"], output: ["text"] },
  },
};

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureGoogleProvider(provider) {
  const next = ensureObject(provider);
  if (!next.google) {
    next.google = { models: {} };
  }
  if (!next.google.models || typeof next.google.models !== "object") {
    next.google.models = {};
  }
  if (!next.google.models["gemini-3.1-pro"]) {
    next.google.models["gemini-3.1-pro"] = {
      name: "Gemini 3.1 Pro (Antigravity)",
      limit: { context: 1048576, output: 65535 },
      modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    };
  }
  if (!next.google.models["gemini-3-flash"]) {
    next.google.models["gemini-3-flash"] = {
      name: "Gemini 3 Flash (Antigravity)",
      limit: { context: 1048576, output: 65536 },
      modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    };
  }
  if (!next.google.models["claude-sonnet-4-6"]) {
    next.google.models["claude-sonnet-4-6"] = {
      name: "Claude Sonnet 4.6 (Antigravity)",
      limit: { context: 200000, output: 64000 },
      modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    };
  }
  if (!next.google.models["claude-sonnet-4-6-thinking"]) {
    next.google.models["claude-sonnet-4-6-thinking"] = {
      name: "Claude Sonnet 4.6 Thinking (Antigravity)",
      limit: { context: 200000, output: 64000 },
      modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    };
  }
  if (!next.google.models["claude-opus-4-6-thinking"]) {
    next.google.models["claude-opus-4-6-thinking"] = {
      name: "Claude Opus 4.6 Thinking (Antigravity)",
      limit: { context: 200000, output: 64000 },
      modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    };
  }
  return next;
}

function ensureChatGptProvider(provider) {
  const next = ensureObject(provider);
  if (!next.openai) {
    next.openai = { models: {} };
  }
  if (!next.openai.models || typeof next.openai.models !== "object") {
    next.openai.models = {};
  }
  for (const [modelId, template] of Object.entries(CHATGPT_MODEL_TEMPLATES)) {
    if (!next.openai.models[modelId]) {
      next.openai.models[modelId] = template;
    }
  }
  return next;
}

function getAccountsSummary() {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    return { total: 0, enabled: 0, disabled: 0, verificationRequired: 0 };
  }
  const payload = readJson(ACCOUNTS_PATH);
  const list = Array.isArray(payload.accounts) ? payload.accounts : [];
  let enabled = 0;
  let disabled = 0;
  let verificationRequired = 0;
  for (const account of list) {
    if (account?.enabled === false) disabled += 1;
    else enabled += 1;
    if (account?.verificationRequired === true) verificationRequired += 1;
  }
  return {
    total: list.length,
    enabled,
    disabled,
    verificationRequired,
  };
}

function getAccountsData() {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    return { total: 0, enabled: 0, disabled: 0, verificationRequired: 0, items: [] };
  }
  const payload = readJson(ACCOUNTS_PATH);
  const list = Array.isArray(payload.accounts) ? payload.accounts : [];
  let enabled = 0;
  let disabled = 0;
  let verificationRequired = 0;

  const items = list.map((account, idx) => {
    const isEnabled = account?.enabled !== false;
    if (isEnabled) enabled += 1;
    else disabled += 1;
    if (account?.verificationRequired === true) verificationRequired += 1;

    const cachedQuota = ensureObject(account?.cachedQuota);
    const quota = Object.entries(cachedQuota).map(([family, info]) => {
      const details = ensureObject(info);
      const fraction = typeof details.remainingFraction === "number" ? details.remainingFraction : null;
      return {
        family,
        remainingFraction: fraction,
        remainingPercent: fraction === null ? null : Math.max(0, Math.min(100, Math.round(fraction * 100))),
        resetTime: typeof details.resetTime === "string" ? details.resetTime : "-",
        modelCount: typeof details.modelCount === "number" ? details.modelCount : null,
      };
    });

    return {
      index: idx,
      email: account?.email || `Account ${idx + 1}`,
      enabled: isEnabled,
      verificationRequired: account?.verificationRequired === true,
      lastUsed: typeof account?.lastUsed === "number" ? account.lastUsed : null,
      addedAt: typeof account?.addedAt === "number" ? account.addedAt : null,
      userAgent: account?.fingerprint?.userAgent || "-",
      platform: account?.fingerprint?.clientMetadata?.platform || "-",
      quota,
    };
  });

  return {
    total: list.length,
    enabled,
    disabled,
    verificationRequired,
    items,
  };
}

function stripAnsi(input) {
  return String(input || "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function getProviderAuthStatus() {
  try {
    const raw = execSync("opencode providers list", { encoding: "utf8" });
    const text = stripAnsi(raw).toLowerCase();
    return {
      google: text.includes("google") && text.includes("oauth"),
      chatgpt: text.includes("openai") && text.includes("oauth"),
    };
  } catch {
    return { google: false, chatgpt: false };
  }
}

function launchProviderLogin(provider) {
  const target = provider === "google" ? "google" : "openai";
  if (process.platform === "win32") {
    const command = `opencode providers login -p ${target}`;
    spawn("cmd.exe", ["/c", "start", "", "cmd", "/k", command], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    }).unref();
    return;
  }
  // Fallback for non-Windows environments
  spawn("opencode", ["providers", "login", "-p", target], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

function launchProviderLogout() {
  if (process.platform === "win32") {
    const command = "opencode providers logout";
    spawn("cmd.exe", ["/c", "start", "", "cmd", "/k", command], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    }).unref();
    return;
  }
  spawn("opencode", ["providers", "logout"], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObject(value[key]);
      return acc;
    }, {});
}

function sameJson(a, b) {
  return JSON.stringify(sortObject(a)) === JSON.stringify(sortObject(b));
}

function getProfile(current, stable, turbo) {
  if (sameJson(current, stable)) return "stable";
  if (sameJson(current, turbo)) return "turbo";
  return "custom";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function ensureConfigFiles() {
  if (!fs.existsSync(CURRENT_CONFIG_PATH)) {
    throw new Error(`Missing config file: ${CURRENT_CONFIG_PATH}`);
  }
  if (!fs.existsSync(STABLE_CONFIG_PATH) || !fs.existsSync(TURBO_CONFIG_PATH)) {
    throw new Error("Missing preset file(s): antigravity.stable.json / antigravity.turbo.json");
  }
  if (!fs.existsSync(HTML_PATH)) {
    throw new Error(`Missing web UI file: ${HTML_PATH}`);
  }
  if (!fs.existsSync(OPENCODE_CONFIG_PATH)) {
    throw new Error(`Missing opencode config: ${OPENCODE_CONFIG_PATH}`);
  }
}

function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/config") {
    const current = readJson(CURRENT_CONFIG_PATH);
    const stable = readJson(STABLE_CONFIG_PATH);
    const turbo = readJson(TURBO_CONFIG_PATH);
    return sendJson(res, 200, {
      current,
      stable,
      turbo,
      activeProfile: getProfile(current, stable, turbo),
    });
  }

  if (req.method === "GET" && req.url === "/api/bootstrap") {
    const current = readJson(CURRENT_CONFIG_PATH);
    const stable = readJson(STABLE_CONFIG_PATH);
    const turbo = readJson(TURBO_CONFIG_PATH);
    const opencode = readJson(OPENCODE_CONFIG_PATH);
    const provider = ensureObject(opencode.provider);
    return sendJson(res, 200, {
      current,
      stable,
      turbo,
      activeProfile: getProfile(current, stable, turbo),
      opencode,
      providers: {
        google: Boolean(provider.google),
        chatgpt: Boolean(provider.openai),
      },
      authStatus: getProviderAuthStatus(),
      accounts: getAccountsData(),
    });
  }

  if (req.method === "POST" && req.url === "/api/config") {
    return readBody(req)
      .then((body) => {
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          throw new Error("Body must be a JSON object");
        }
        writeJson(CURRENT_CONFIG_PATH, body);
        return sendJson(res, 200, { ok: true, message: "Config saved to antigravity.json" });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: String(error.message || error) }));
  }

  if (req.method === "POST" && req.url === "/api/profile") {
    return readBody(req)
      .then((body) => {
        const profile = body.profile;
        if (profile !== "stable" && profile !== "turbo") {
          throw new Error("profile must be 'stable' or 'turbo'");
        }
        const source = profile === "stable" ? STABLE_CONFIG_PATH : TURBO_CONFIG_PATH;
        const preset = readJson(source);
        writeJson(CURRENT_CONFIG_PATH, preset);
        return sendJson(res, 200, { ok: true, message: `Activated ${profile} profile` });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: String(error.message || error) }));
  }

  if (req.method === "POST" && req.url === "/api/opencode") {
    return readBody(req)
      .then((body) => {
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          throw new Error("Body must be a JSON object");
        }
        writeJson(OPENCODE_CONFIG_PATH, body);
        return sendJson(res, 200, { ok: true, message: "Saved opencode.json" });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: String(error.message || error) }));
  }

  if (req.method === "POST" && req.url === "/api/providers") {
    return readBody(req)
      .then((body) => {
        const google = Boolean(body.google);
        const chatgpt = Boolean(body.chatgpt);
        const opencode = readJson(OPENCODE_CONFIG_PATH);
        opencode.provider = ensureObject(opencode.provider);

        if (google) {
          opencode.provider = ensureGoogleProvider(opencode.provider);
        } else {
          delete opencode.provider.google;
        }

        if (chatgpt) {
          opencode.provider = ensureChatGptProvider(opencode.provider);
        } else {
          delete opencode.provider.openai;
        }

        writeJson(OPENCODE_CONFIG_PATH, opencode);
        return sendJson(res, 200, {
          ok: true,
          message: "Provider settings updated in opencode.json",
          providers: {
            google: Boolean(opencode.provider.google),
            chatgpt: Boolean(opencode.provider.openai),
          },
          authStatus: getProviderAuthStatus(),
        });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: String(error.message || error) }));
  }

  if (req.method === "POST" && req.url === "/api/providers/login") {
    return readBody(req)
      .then((body) => {
        const provider = String(body.provider || "").toLowerCase();
        if (provider !== "google" && provider !== "chatgpt" && provider !== "openai") {
          throw new Error("provider must be 'google' or 'chatgpt'");
        }
        launchProviderLogin(provider === "chatgpt" ? "openai" : provider);
        return sendJson(res, 200, {
          ok: true,
          message: `Opened auth terminal for ${provider === "chatgpt" ? "ChatGPT" : "Google"}`,
        });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: String(error.message || error) }));
  }

  if (req.method === "POST" && req.url === "/api/providers/logout") {
    return readBody(req)
      .then((body) => {
        const provider = String(body.provider || "provider");
        launchProviderLogout();
        return sendJson(res, 200, {
          ok: true,
          message: `Opened logout terminal for ${provider}. Complete logout flow in terminal.`,
        });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: String(error.message || error) }));
  }

  if (req.method === "GET" && req.url === "/api/health") {
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

function requestHandler(req, res) {
  try {
    if (String(req.url || "").startsWith("/api/")) {
      const handled = handleApi(req, res);
      if (handled !== false) return;
      return sendJson(res, 404, { ok: false, error: "Not found" });
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      const html = fs.readFileSync(HTML_PATH, "utf8");
      return sendText(res, 200, html, "text/html; charset=utf-8");
    }

    return sendText(res, 404, "Not found");
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: String(error.message || error) });
  }
}

function start() {
  ensureConfigFiles();
  const server = http.createServer(requestHandler);
  server.listen(PORT, HOST, () => {
    console.log(`[ag-web] Antigravity Web UI running at http://${HOST}:${PORT}`);
    console.log("[ag-web] CLI config tetap aktif. UI ini hanya opsi tambahan.");
  });
}

start();
