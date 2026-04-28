const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

function loadPipelineWithMocks(mocks = {}) {
  const moduleIds = {
    pipeline: require.resolve("../src/core/pipeline"),
    config: require.resolve("../src/core/config"),
    storage: require.resolve("../src/core/storage"),
    reddit: require.resolve("../src/core/reddit"),
    scorer: require.resolve("../src/core/scorer"),
    drafter: require.resolve("../src/core/drafter")
  };

  Object.values(moduleIds).forEach((id) => {
    delete require.cache[id];
  });

  require.cache[moduleIds.config] = {
    id: moduleIds.config,
    filename: moduleIds.config,
    loaded: true,
    exports: mocks.config
  };
  require.cache[moduleIds.storage] = {
    id: moduleIds.storage,
    filename: moduleIds.storage,
    loaded: true,
    exports: mocks.storage
  };
  require.cache[moduleIds.reddit] = {
    id: moduleIds.reddit,
    filename: moduleIds.reddit,
    loaded: true,
    exports: mocks.reddit
  };
  require.cache[moduleIds.scorer] = {
    id: moduleIds.scorer,
    filename: moduleIds.scorer,
    loaded: true,
    exports: mocks.scorer
  };
  require.cache[moduleIds.drafter] = {
    id: moduleIds.drafter,
    filename: moduleIds.drafter,
    loaded: true,
    exports: mocks.drafter
  };

  return require("../src/core/pipeline");
}

function baseConfig() {
  return {
    subreddits: ["SaaS"],
    keywords: ["tool"],
    daysBack: 7,
    minUpvotes: 0,
    minComments: 0,
    maxThreads: 10,
    compliance: { maxWords: 120, bannedTerms: [], requireSoftTone: true }
  };
}

test("runScan writes fetched threads", async () => {
  let writeCall = null;
  const cfg = baseConfig();
  const pipeline = loadPipelineWithMocks({
    config: { loadConfig: () => cfg, DATA_DIR: process.cwd() },
    storage: {
      writeJson: (name, data) => {
        writeCall = { name, data };
      },
      readJson: () => []
    },
    reddit: {
      fetchThreads: async () => [{ id: "t1", title: "post", body: "", upvotes: 1, comments: 1, ageDays: 0 }]
    },
    scorer: { rankThreads: () => [] },
    drafter: { createDrafts: async () => [] }
  });

  const result = await pipeline.runScan();
  assert.equal(result.count, 1);
  assert.equal(writeCall.name, "threads.raw.json");
  assert.equal(writeCall.data.length, 1);
});

test("runRank returns guidance when no raw threads", () => {
  const cfg = baseConfig();
  const pipeline = loadPipelineWithMocks({
    config: { loadConfig: () => cfg, DATA_DIR: process.cwd() },
    storage: {
      writeJson: () => {},
      readJson: () => []
    },
    reddit: { fetchThreads: async () => [] },
    scorer: { rankThreads: () => [] },
    drafter: { createDrafts: async () => [] }
  });

  const result = pipeline.runRank();
  assert.match(result.message, /No raw threads found/);
});

test("runRank filters error rows and ranks actionable rows", () => {
  const cfg = baseConfig();
  let rankedWritten = null;
  const pipeline = loadPipelineWithMocks({
    config: { loadConfig: () => cfg, DATA_DIR: process.cwd() },
    storage: {
      writeJson: (name, data) => {
        if (name === "threads.ranked.json") rankedWritten = data;
      },
      readJson: () => [
        { id: "error-SaaS", title: "error row", body: "", upvotes: 0, comments: 0, ageDays: 0 },
        { id: "ok-1", title: "hello", body: "", upvotes: 4, comments: 3, ageDays: 1 }
      ]
    },
    reddit: { fetchThreads: async () => [] },
    scorer: {
      rankThreads: (threads) => threads.map((t) => ({ ...t, score: 42 }))
    },
    drafter: { createDrafts: async () => [] }
  });

  const result = pipeline.runRank();
  assert.equal(result.count, 1);
  assert.equal(result.topScore, 42);
  assert.equal(rankedWritten.length, 1);
  assert.equal(rankedWritten[0].id, "ok-1");
});

test("runDraft writes drafts and runExport creates markdown", async () => {
  const cfg = baseConfig();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reddit-engage-test-"));
  let writtenDrafts = null;
  const pipeline = loadPipelineWithMocks({
    config: { loadConfig: () => cfg, DATA_DIR: tempDir },
    storage: {
      writeJson: (name, data) => {
        if (name === "drafts.json") writtenDrafts = data;
      },
      readJson: (name) => {
        if (name === "threads.ranked.json") {
          return [{ id: "ok-1", title: "Need help?", body: "text", upvotes: 3, comments: 2, ageDays: 1, url: "https://reddit.com/x" }];
        }
        if (name === "drafts.json") {
          return [
            {
              title: "Need help?",
              threadUrl: "https://reddit.com/x",
              threadId: "ok-1",
              source: "fallback-template",
              compliance: { approved: true, flags: [] },
              draft: "Helpful answer here.",
              guardrails: ["No hard CTA"]
            }
          ];
        }
        return [];
      }
    },
    reddit: { fetchThreads: async () => [] },
    scorer: { rankThreads: () => [] },
    drafter: {
      createDrafts: async (ranked) =>
        ranked.map((r) => ({
          threadId: r.id,
          title: r.title,
          threadUrl: r.url,
          source: "fallback-template",
          compliance: { approved: true, flags: [] },
          draft: "Helpful answer here.",
          guardrails: ["No hard CTA"]
        }))
    }
  });

  const draftResult = await pipeline.runDraft();
  assert.equal(draftResult.count, 1);
  assert.equal(writtenDrafts.length, 1);

  const exportResult = pipeline.runExport();
  assert.equal(exportResult.count, 1);
  const reviewPath = path.join(tempDir, "review-queue.md");
  assert.equal(fs.existsSync(reviewPath), true);
  const content = fs.readFileSync(reviewPath, "utf8");
  assert.match(content, /Reddit Engage Review Queue/);
  assert.match(content, /Helpful answer here/);
});

