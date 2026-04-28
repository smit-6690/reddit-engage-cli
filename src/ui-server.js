const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { readJson, writeJson } = require("./core/storage");
const { loadConfig, saveConfig } = require("./core/config");
const { getReviewMap, updateReviewStatus } = require("./core/review-store");
const { runScan, runRank, runDraft, runExport, runAll } = require("./core/pipeline");
const { buildDraft } = require("./core/drafter");
const { validateDraft } = require("./core/compliance");

const PORT = process.env.PORT || 3080;
const PUBLIC_DIR = path.join(__dirname, "..", "web");

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendFile(res, filePath, contentType) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    res.writeHead(200, { "Content-Type": `${contentType}; charset=utf-8` });
    res.end(content);
  } catch (_error) {
    sendJson(res, 404, { error: "Not found" });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (raw.length > 2_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function withReviewStatus(drafts, reviewMap) {
  return drafts.map((draft) => ({
    ...draft,
    review: reviewMap[draft.threadId] || { status: "pending", updatedAt: null }
  }));
}

function paginate(items, page, pageSize) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));
  const start = (safePage - 1) * safePageSize;
  return {
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
    items: items.slice(start, start + safePageSize)
  };
}

function updateDraft(threadId, updater) {
  const drafts = readJson("drafts.json", []);
  const idx = drafts.findIndex((item) => item.threadId === threadId);
  if (idx < 0) {
    throw new Error("Draft not found");
  }
  drafts[idx] = updater(drafts[idx]);
  writeJson("drafts.json", drafts);
  return drafts[idx];
}

function suggestKeywordsFromRanked() {
  const ranked = readJson("threads.ranked.json", []);
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "have", "your", "you", "how", "any",
    "are", "was", "but", "not", "too", "can", "into", "about", "need", "what", "when", "where",
    "will", "they", "their", "them", "our", "out", "all", "has", "had", "its", "who", "why"
  ]);
  const counts = new Map();
  ranked.forEach((item) => {
    const text = `${item.title} ${item.body || ""}`.toLowerCase();
    const words = text.match(/[a-z][a-z0-9-]{2,}/g) || [];
    words.forEach((word) => {
      if (stopWords.has(word)) return;
      counts.set(word, (counts.get(word) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, score]) => ({ keyword, score }));
}

function getDashboardData() {
  const raw = readJson("threads.raw.json", []);
  const ranked = readJson("threads.ranked.json", []);
  const drafts = readJson("drafts.json", []);
  const reviewMap = getReviewMap();
  const draftsWithStatus = withReviewStatus(drafts, reviewMap);
  const approved = draftsWithStatus.filter((d) => d.review.status === "approved").length;
  const rejected = draftsWithStatus.filter((d) => d.review.status === "rejected").length;
  return {
    counts: {
      raw: raw.length,
      ranked: ranked.length,
      drafts: drafts.length,
      approved,
      rejected,
      pending: drafts.length - approved - rejected
    },
    topRanked: ranked.slice(0, 8),
    topDrafts: draftsWithStatus.slice(0, 8)
  };
}

async function handleAction(action) {
  if (action === "scan") return runScan();
  if (action === "rank") return runRank();
  if (action === "draft") return runDraft();
  if (action === "export") return runExport();
  if (action === "all") return runAll();
  throw new Error("Unknown action");
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    return sendJson(res, 400, { error: "Missing URL" });
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/dashboard") {
    return sendJson(res, 200, getDashboardData());
  }

  if (req.method === "GET" && pathname === "/api/config") {
    return sendJson(res, 200, loadConfig());
  }

  if (req.method === "PUT" && pathname === "/api/config") {
    try {
      const body = await readBody(req);
      const saved = saveConfig(body);
      return sendJson(res, 200, { ok: true, config: saved });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && pathname === "/api/leads") {
    const ranked = readJson("threads.ranked.json", []);
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const subreddit = (url.searchParams.get("subreddit") || "").toLowerCase();
    const filtered = ranked.filter((lead) => {
      const matchQuery =
        !q ||
        lead.title.toLowerCase().includes(q) ||
        (lead.body || "").toLowerCase().includes(q);
      const matchSubreddit = !subreddit || lead.subreddit.toLowerCase() === subreddit;
      return matchQuery && matchSubreddit;
    });
    return sendJson(
      res,
      200,
      paginate(filtered, url.searchParams.get("page"), url.searchParams.get("pageSize"))
    );
  }

  if (req.method === "GET" && pathname === "/api/drafts") {
    const drafts = withReviewStatus(readJson("drafts.json", []), getReviewMap());
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const status = (url.searchParams.get("status") || "").toLowerCase();
    const filtered = drafts.filter((draft) => {
      const matchQuery =
        !q ||
        draft.title.toLowerCase().includes(q) ||
        draft.draft.toLowerCase().includes(q);
      const matchStatus = !status || draft.review.status === status;
      return matchQuery && matchStatus;
    });
    return sendJson(
      res,
      200,
      paginate(filtered, url.searchParams.get("page"), url.searchParams.get("pageSize"))
    );
  }

  if (req.method === "PUT" && pathname === "/api/drafts/content") {
    try {
      const body = await readBody(req);
      if (!body.threadId || !body.draft) {
        return sendJson(res, 400, { ok: false, error: "threadId and draft are required" });
      }
      const saved = updateDraft(body.threadId, (current) => ({
        ...current,
        draft: body.draft.trim(),
        source: "manual-edit",
        compliance: validateDraft(body.draft.trim(), loadConfig().compliance)
      }));
      return sendJson(res, 200, { ok: true, draft: saved });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/drafts/regenerate") {
    try {
      const body = await readBody(req);
      if (!body.threadId) {
        return sendJson(res, 400, { ok: false, error: "threadId is required" });
      }
      const ranked = readJson("threads.ranked.json", []);
      const thread = ranked.find((item) => item.id === body.threadId);
      if (!thread) {
        return sendJson(res, 404, { ok: false, error: "Thread not found in ranked data" });
      }
      const draft = await buildDraft(thread, loadConfig(), body.style || "balanced");
      const saved = updateDraft(body.threadId, (current) => ({
        ...current,
        draft: draft.draft,
        source: `${draft.source}-regenerated`,
        compliance: draft.compliance,
        style: body.style || "balanced",
        variants: current.variants || []
      }));
      return sendJson(res, 200, { ok: true, draft: saved });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "PUT" && pathname === "/api/drafts/status") {
    try {
      const body = await readBody(req);
      if (!body.threadId || !body.status) {
        return sendJson(res, 400, { ok: false, error: "threadId and status are required" });
      }
      if (!["pending", "approved", "rejected"].includes(body.status)) {
        return sendJson(res, 400, { ok: false, error: "Invalid status" });
      }
      const saved = updateReviewStatus(body.threadId, body.status);
      return sendJson(res, 200, { ok: true, review: saved });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && pathname === "/api/keywords/suggest") {
    return sendJson(res, 200, { suggestions: suggestKeywordsFromRanked() });
  }

  if (req.method === "POST" && pathname.startsWith("/api/run/")) {
    const action = pathname.replace("/api/run/", "");
    try {
      const result = await handleAction(action);
      return sendJson(res, 200, { ok: true, action, result });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && pathname === "/app.js") {
    return sendFile(res, path.join(PUBLIC_DIR, "app.js"), "application/javascript");
  }

  if (req.method === "GET" && pathname === "/styles.css") {
    return sendFile(res, path.join(PUBLIC_DIR, "styles.css"), "text/css");
  }

  if (req.method === "GET" && pathname === "/") {
    return sendFile(res, path.join(PUBLIC_DIR, "index.html"), "text/html");
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Reddit-Engage UI running at http://localhost:${PORT}`);
});
