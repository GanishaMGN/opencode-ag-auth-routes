const fs = require("node:fs");
const path = require("node:path");

const accountsPath = path.join(__dirname, "antigravity-accounts.json");

function safeFraction(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readAccounts() {
  if (!fs.existsSync(accountsPath)) {
    return { version: 4, accounts: [], activeIndex: 0, activeIndexByFamily: { claude: 0, gemini: 0 } };
  }
  return JSON.parse(fs.readFileSync(accountsPath, "utf8"));
}

function scoreAccount(account) {
  const cachedQuota = account?.cachedQuota || {};
  const geminiPro = safeFraction(cachedQuota["gemini-pro"]?.remainingFraction);
  const geminiFlash = safeFraction(cachedQuota["gemini-flash"]?.remainingFraction);
  const claude = safeFraction(cachedQuota.claude?.remainingFraction);
  const enabledBonus = account?.enabled === false ? -10 : 5;
  return {
    geminiPro,
    geminiFlash,
    claude,
    overall: geminiPro + geminiFlash + claude + enabledBonus,
    gemini: geminiPro + geminiFlash + enabledBonus,
    claudeScore: claude + enabledBonus,
  };
}

function rankAccounts(accounts) {
  return accounts
    .map((account, index) => {
      const scores = scoreAccount(account);
      return {
        index,
        email: account?.email || `Account ${index + 1}`,
        enabled: account?.enabled !== false,
        lastUsed: account?.lastUsed || 0,
        userAgent: account?.fingerprint?.userAgent || "-",
        platform: account?.fingerprint?.clientMetadata?.platform || "-",
        ...scores,
      };
    })
    .sort((a, b) => b.overall - a.overall || b.lastUsed - a.lastUsed);
}

function main() {
  const payload = readAccounts();
  const ranked = rankAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
  const summary = {
    activeIndex: payload.activeIndex ?? 0,
    activeIndexByFamily: payload.activeIndexByFamily || { claude: 0, gemini: 0 },
    recommendedOverall: ranked[0]?.index ?? -1,
    recommendedGemini: [...ranked].sort((a, b) => b.gemini - a.gemini || b.lastUsed - a.lastUsed)[0]?.index ?? -1,
    recommendedClaude: [...ranked].sort((a, b) => b.claudeScore - a.claudeScore || b.lastUsed - a.lastUsed)[0]?.index ?? -1,
    ranked,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
