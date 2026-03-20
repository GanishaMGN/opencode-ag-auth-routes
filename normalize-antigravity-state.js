const fs = require("node:fs");
const path = require("node:path");

const configDir = __dirname;
const accountsPath = path.join(configDir, "antigravity-accounts.json");

const RATE_LIMIT_KEY_MAP = {
  "gemini-antigravity:antigravity-gemini-3.1-pro": "gemini-antigravity:gemini-3.1-pro",
  "gemini-antigravity:antigravity-gemini-3-flash": "gemini-antigravity:gemini-3-flash",
  "claude-antigravity:antigravity-claude-sonnet-4-6": "claude-antigravity:claude-sonnet-4-6",
  "claude-antigravity:antigravity-claude-sonnet-4-6-thinking": "claude-antigravity:claude-sonnet-4-6-thinking",
  "claude-antigravity:antigravity-claude-opus-4-6-thinking": "claude-antigravity:claude-opus-4-6-thinking",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeRateLimitResetTimes(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const output = {};
  for (const [key, ts] of Object.entries(input)) {
    const nextKey = RATE_LIMIT_KEY_MAP[key] || key;
    output[nextKey] = ts;
  }
  return output;
}

function main() {
  if (!fs.existsSync(accountsPath)) {
    console.log("No antigravity-accounts.json found; nothing to normalize.");
    return;
  }

  const payload = readJson(accountsPath);
  const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
  let changed = false;

  for (const account of accounts) {
    const before = JSON.stringify(account.rateLimitResetTimes || {});
    account.rateLimitResetTimes = normalizeRateLimitResetTimes(account.rateLimitResetTimes);
    const after = JSON.stringify(account.rateLimitResetTimes);
    if (before !== after) {
      changed = true;
    }
    if (!account.cachedQuota || typeof account.cachedQuota !== "object" || Array.isArray(account.cachedQuota)) {
      account.cachedQuota = {};
      changed = true;
    }
  }

  if (!changed) {
    console.log("State already normalized.");
    return;
  }

  writeJson(accountsPath, payload);
  console.log(`Normalized ${accounts.length} account record(s).`);
}

main();
