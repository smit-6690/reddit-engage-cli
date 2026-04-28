const path = require("path");
const fs = require("fs");
const { loadConfig, DATA_DIR } = require("./config");
const { writeJson, readJson } = require("./storage");
const { fetchThreads } = require("./reddit");
const { rankThreads } = require("./scorer");
const { createDrafts } = require("./drafter");

function ensureConfig() {
  return loadConfig();
}

function initProject() {
  const cfg = ensureConfig();
  return {
    configPath: path.resolve("engage.config.json"),
    subreddits: cfg.subreddits
  };
}

async function runScan() {
  const cfg = ensureConfig();
  const threads = await fetchThreads(cfg);
  writeJson("threads.raw.json", threads);
  return {
    count: threads.length,
    output: "data/threads.raw.json"
  };
}

function runRank() {
  const cfg = ensureConfig();
  const threads = readJson("threads.raw.json", []);
  if (!threads.length) {
    return {
      count: 0,
      message: "No raw threads found. Run `scan` first."
    };
  }
  const actionable = threads.filter((thread) => !String(thread.id || "").startsWith("error-"));
  if (!actionable.length) {
    writeJson("threads.ranked.json", []);
    return {
      count: 0,
      message: "No actionable threads found. Scan has fetch errors only; check Reddit API credentials/network."
    };
  }
  const ranked = rankThreads(actionable, cfg);
  writeJson("threads.ranked.json", ranked);
  return {
    count: ranked.length,
    topScore: ranked[0].score,
    output: "data/threads.ranked.json"
  };
}

async function runDraft() {
  const cfg = ensureConfig();
  const ranked = readJson("threads.ranked.json", []);
  if (!ranked.length) {
    return {
      count: 0,
      message: "No ranked threads found. Run `rank` first."
    };
  }
  const drafts = await createDrafts(ranked, cfg);
  writeJson("drafts.json", drafts);
  return {
    count: drafts.length,
    output: "data/drafts.json"
  };
}

function runExport() {
  const drafts = readJson("drafts.json", []);
  if (!drafts.length) {
    return {
      count: 0,
      message: "No drafts found. Run `draft` first."
    };
  }

  const out = ["# Reddit Engage Review Queue", ""];
  drafts.forEach((item, idx) => {
    out.push(`## ${idx + 1}. ${item.title}`);
    out.push(`- Thread: ${item.threadUrl}`);
    out.push(`- Thread ID: ${item.threadId}`);
    out.push(`- Draft source: ${item.source}`);
    out.push(`- Compliance approved: ${item.compliance.approved ? "yes" : "no"}`);
    if (item.compliance.flags.length) {
      out.push(`- Compliance flags: ${item.compliance.flags.join(", ")}`);
    }
    out.push("- Draft reply:");
    out.push("");
    out.push(item.draft);
    out.push("");
    out.push(`- Guardrails: ${item.guardrails.join(", ")}`);
    out.push("");
  });

  const file = path.join(DATA_DIR, "review-queue.md");
  fs.writeFileSync(file, `${out.join("\n")}\n`, "utf8");
  return {
    count: drafts.length,
    output: "data/review-queue.md"
  };
}

async function runAll() {
  const scan = await runScan();
  const rank = runRank();
  const draft = await runDraft();
  const exportResult = runExport();
  return { scan, rank, draft, export: exportResult };
}

module.exports = {
  initProject,
  runScan,
  runRank,
  runDraft,
  runExport,
  runAll
};
