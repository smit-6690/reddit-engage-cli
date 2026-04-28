const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONFIG_PATH = path.join(ROOT_DIR, "engage.config.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function defaultConfig() {
  return {
    subreddits: ["SaaS", "Entrepreneur", "smallbusiness"],
    subredditQuery: "",
    autoDiscoverSubreddits: true,
    maxDiscoveredSubreddits: 8,
    keywords: ["recommend", "tool", "looking for", "how do I"],
    daysBack: 7,
    minUpvotes: 3,
    minComments: 2,
    maxThreads: 25,
    brandName: "Your Product",
    brandSummary: "A short description of what your product helps users do.",
    voice: "Helpful, practical, no hard selling.",
    llm: {
      provider: "ollama",
      model: "llama3.2:3b",
      baseUrl: "http://localhost:11434",
      timeoutMs: 4000,
      openRouterApiKey: "",
      openRouterBaseUrl: "https://openrouter.ai/api/v1",
      openRouterModel: "meta-llama/llama-3.3-8b-instruct:free"
    },
    compliance: {
      maxWords: 120,
      bannedTerms: ["guaranteed", "instant results", "100%"],
      requireSoftTone: true
    }
  };
}

function loadConfig() {
  ensureDataDir();

  if (!fs.existsSync(CONFIG_PATH)) {
    const cfg = defaultConfig();
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
    return cfg;
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const userConfig = JSON.parse(raw);
  const merged = {
    ...defaultConfig(),
    ...userConfig,
    llm: {
      ...defaultConfig().llm,
      ...(userConfig.llm || {})
    },
    compliance: {
      ...defaultConfig().compliance,
      ...(userConfig.compliance || {})
    }
  };
  return merged;
}

function saveConfig(nextConfig) {
  ensureDataDir();
  const merged = {
    ...defaultConfig(),
    ...nextConfig,
    llm: {
      ...defaultConfig().llm,
      ...((nextConfig && nextConfig.llm) || {})
    },
    compliance: {
      ...defaultConfig().compliance,
      ...((nextConfig && nextConfig.compliance) || {})
    }
  };
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  CONFIG_PATH,
  loadConfig,
  saveConfig
};
