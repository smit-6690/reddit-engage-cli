async function getDashboard() {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

async function getKeywordSuggestions() {
  const res = await fetch("/api/keywords/suggest");
  if (!res.ok) throw new Error("Failed to fetch keyword suggestions");
  return res.json();
}

async function runAction(action) {
  const res = await fetch(`/api/run/${action}`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to run ${action}`);
  return res.json();
}

async function runAllWithProgress() {
  const steps = ["scan", "rank", "draft", "export"];
  for (let idx = 0; idx < steps.length; idx += 1) {
    const action = steps[idx];
    setStatus(`Running ${action} (${idx + 1}/${steps.length})...`);
    await runAction(action);
    await refresh();
  }
}

async function getConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

async function saveConfig(config) {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error("Failed to save config");
  return res.json();
}

async function getLeads({ page = 1, pageSize = 8, q = "", subreddit = "" }) {
  const params = new URLSearchParams({ page, pageSize, q, subreddit });
  const res = await fetch(`/api/leads?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load leads");
  return res.json();
}

async function getDrafts({ page = 1, pageSize = 8, q = "", status = "" }) {
  const params = new URLSearchParams({ page, pageSize, q, status });
  const res = await fetch(`/api/drafts?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load drafts");
  return res.json();
}

async function setDraftStatus(threadId, status) {
  const res = await fetch("/api/drafts/status", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, status })
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}

async function saveDraftContent(threadId, draft) {
  const res = await fetch("/api/drafts/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, draft })
  });
  if (!res.ok) throw new Error("Failed to save draft content");
  return res.json();
}

async function regenerateDraft(threadId, style) {
  const res = await fetch("/api/drafts/regenerate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, style })
  });
  if (!res.ok) throw new Error("Failed to regenerate draft");
  return res.json();
}

const state = {
  leadPage: 1,
  leadPageSize: 8,
  leadQuery: "",
  leadSubreddit: "",
  draftPage: 1,
  draftPageSize: 8,
  draftQuery: "",
  draftStatus: ""
};

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function renderCounts(counts) {
  document.getElementById("rawCount").textContent = counts.raw;
  document.getElementById("rankedCount").textContent = counts.ranked;
  document.getElementById("draftCount").textContent = counts.drafts;
  document.getElementById("approvedCount").textContent = counts.approved || 0;
  document.getElementById("rejectedCount").textContent = counts.rejected || 0;
  document.getElementById("pendingCount").textContent = counts.pending || 0;
}

function renderRanked(payload) {
  const items = payload.items || [];
  const root = document.getElementById("rankedList");
  root.innerHTML = "";
  if (!items.length) {
    root.innerHTML = "<div class='item'>No ranked threads yet.</div>";
    return;
  }
  items.forEach((item) => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <h3>${item.title}</h3>
      <div class="meta">r/${item.subreddit} | Score ${item.score} | ${item.upvotes} ups | ${item.comments} comments</div>
    `;
    root.appendChild(el);
  });
  const totalPages = Math.max(1, Math.ceil((payload.total || 0) / (payload.pageSize || 1)));
  document.getElementById("leadPageLabel").textContent = `Page ${payload.page || 1} / ${totalPages}`;
}

function reviewControls(threadId, currentStatus) {
  const statuses = ["pending", "approved", "rejected"];
  return statuses
    .map((status) => {
      const disabled = currentStatus === status ? "disabled" : "";
      return `<button class="review-btn" data-thread-id="${threadId}" data-review-status="${status}" ${disabled}>${status}</button>`;
    })
    .join(" ");
}

function variantOptions(item) {
  const variants = item.variants || [];
  if (!variants.length) return '<option value="balanced">balanced</option>';
  return variants
    .map((variant) => {
      const selected = (item.style || "balanced") === variant.style ? "selected" : "";
      return `<option value="${variant.style}" ${selected}>${variant.style}</option>`;
    })
    .join("");
}

function renderDrafts(payload) {
  const items = payload.items || [];
  const root = document.getElementById("draftList");
  root.innerHTML = "";
  if (!items.length) {
    root.innerHTML = "<div class='item'>No drafts yet.</div>";
    return;
  }
  items.forEach((item) => {
    const flags = item.compliance && item.compliance.flags ? item.compliance.flags.join(", ") : "";
    const reviewStatus = item.review && item.review.status ? item.review.status : "pending";
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <h3>${item.title}</h3>
      <div class="meta">source: ${item.source} | compliance: ${item.compliance.approved ? "yes" : "no"} | review: ${reviewStatus}</div>
      <textarea class="draft-editor" data-thread-id="${item.threadId}">${item.draft}</textarea>
      ${flags ? `<div class="meta">flags: ${flags}</div>` : ""}
      <div class="toolbar">
        ${reviewControls(item.threadId, reviewStatus)}
        <select data-variant-thread-id="${item.threadId}">${variantOptions(item)}</select>
        <button data-save-thread-id="${item.threadId}">Save Edit</button>
        <button data-regen-thread-id="${item.threadId}">Regenerate</button>
      </div>
    `;
    root.appendChild(el);
  });
  const totalPages = Math.max(1, Math.ceil((payload.total || 0) / (payload.pageSize || 1)));
  document.getElementById("draftPageLabel").textContent = `Page ${payload.page || 1} / ${totalPages}`;
  attachReviewActions();
  attachDraftActions();
}

function hydrateConfigForm(config) {
  document.getElementById("cfgSubreddits").value = (config.subreddits || []).join(", ");
  document.getElementById("cfgKeywords").value = (config.keywords || []).join(", ");
  document.getElementById("cfgDaysBack").value = config.daysBack || 7;
  document.getElementById("cfgMinUpvotes").value = config.minUpvotes || 0;
  document.getElementById("cfgMinComments").value = config.minComments || 0;
  document.getElementById("cfgMaxThreads").value = config.maxThreads || 25;
  document.getElementById("cfgBrandName").value = config.brandName || "";
  document.getElementById("cfgBrandSummary").value = config.brandSummary || "";
  document.getElementById("cfgVoice").value = config.voice || "";
  document.getElementById("cfgProvider").value = (config.llm && config.llm.provider) || "ollama";
  document.getElementById("cfgModel").value = (config.llm && config.llm.model) || "";
}

function buildConfigFromForm(existingConfig) {
  return {
    ...existingConfig,
    subreddits: document.getElementById("cfgSubreddits").value.split(",").map((v) => v.trim()).filter(Boolean),
    keywords: document.getElementById("cfgKeywords").value.split(",").map((v) => v.trim()).filter(Boolean),
    daysBack: Number(document.getElementById("cfgDaysBack").value),
    minUpvotes: Number(document.getElementById("cfgMinUpvotes").value),
    minComments: Number(document.getElementById("cfgMinComments").value),
    maxThreads: Number(document.getElementById("cfgMaxThreads").value),
    brandName: document.getElementById("cfgBrandName").value.trim(),
    brandSummary: document.getElementById("cfgBrandSummary").value.trim(),
    voice: document.getElementById("cfgVoice").value.trim(),
    llm: {
      ...(existingConfig.llm || {}),
      provider: document.getElementById("cfgProvider").value,
      model: document.getElementById("cfgModel").value.trim()
    }
  };
}

function renderKeywordSuggestions(suggestions) {
  const root = document.getElementById("keywordSuggestions");
  if (!suggestions.length) {
    root.textContent = "No keyword suggestions yet. Run Rank first.";
    return;
  }
  root.innerHTML = `Suggested keywords: ${suggestions
    .slice(0, 12)
    .map((s) => `<code>${s.keyword}</code>`)
    .join(", ")}`;
}

async function refresh() {
  const data = await getDashboard();
  renderCounts(data.counts);
  const leads = await getLeads({
    page: state.leadPage,
    pageSize: state.leadPageSize,
    q: state.leadQuery,
    subreddit: state.leadSubreddit
  });
  renderRanked(leads);
  const drafts = await getDrafts({
    page: state.draftPage,
    pageSize: state.draftPageSize,
    q: state.draftQuery,
    status: state.draftStatus
  });
  renderDrafts(drafts);
}

function attachActions() {
  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      const buttons = document.querySelectorAll("button[data-action]");
      buttons.forEach((b) => { b.disabled = true; });
      setStatus(`Running ${action}...`);
      try {
        if (action === "all") {
          await runAllWithProgress();
        } else {
          await runAction(action);
          await refresh();
        }
        setStatus(`Completed ${action}`);
      } catch (error) {
        setStatus(error.message);
      } finally {
        buttons.forEach((b) => { b.disabled = false; });
      }
    });
  });
}

function attachConfigForm() {
  const form = document.getElementById("configForm");
  let currentConfig = null;
  getConfig()
    .then((config) => {
      currentConfig = config;
      hydrateConfigForm(config);
    })
    .catch((error) => setStatus(error.message));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentConfig) return;
    setStatus("Saving config...");
    try {
      const next = buildConfigFromForm(currentConfig);
      const result = await saveConfig(next);
      currentConfig = result.config;
      setStatus("Config saved");
    } catch (error) {
      setStatus(error.message);
    }
  });

  document.getElementById("suggestKeywordsBtn").addEventListener("click", async () => {
    setStatus("Generating keyword suggestions...");
    try {
      const result = await getKeywordSuggestions();
      renderKeywordSuggestions(result.suggestions || []);
      const keywords = (result.suggestions || []).slice(0, 8).map((s) => s.keyword);
      if (keywords.length) {
        document.getElementById("cfgKeywords").value = keywords.join(", ");
      }
      setStatus("Keyword suggestions ready");
    } catch (error) {
      setStatus(error.message);
    }
  });
}

function attachLeadFilters() {
  document.getElementById("leadSearchBtn").addEventListener("click", async () => {
    state.leadQuery = document.getElementById("leadSearch").value.trim();
    state.leadSubreddit = document.getElementById("leadSubreddit").value.trim();
    state.leadPage = 1;
    await refresh();
  });
  document.getElementById("leadPrev").addEventListener("click", async () => {
    state.leadPage = Math.max(1, state.leadPage - 1);
    await refresh();
  });
  document.getElementById("leadNext").addEventListener("click", async () => {
    state.leadPage += 1;
    await refresh();
  });
}

function attachDraftFilters() {
  document.getElementById("draftSearchBtn").addEventListener("click", async () => {
    state.draftQuery = document.getElementById("draftSearch").value.trim();
    state.draftStatus = document.getElementById("draftStatusFilter").value;
    state.draftPage = 1;
    await refresh();
  });
  document.getElementById("draftPrev").addEventListener("click", async () => {
    state.draftPage = Math.max(1, state.draftPage - 1);
    await refresh();
  });
  document.getElementById("draftNext").addEventListener("click", async () => {
    state.draftPage += 1;
    await refresh();
  });
}

function attachReviewActions() {
  document.querySelectorAll("button[data-thread-id][data-review-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const threadId = button.dataset.threadId;
      const status = button.dataset.reviewStatus;
      setStatus(`Updating ${threadId} -> ${status}...`);
      try {
        await setDraftStatus(threadId, status);
        await refresh();
        setStatus("Review status updated");
      } catch (error) {
        setStatus(error.message);
      }
    });
  });
}

function attachDraftActions() {
  document.querySelectorAll("button[data-save-thread-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const threadId = button.dataset.saveThreadId;
      const editor = document.querySelector(`textarea[data-thread-id="${threadId}"]`);
      if (!editor) return;
      setStatus(`Saving edited draft for ${threadId}...`);
      try {
        await saveDraftContent(threadId, editor.value);
        await refresh();
        setStatus("Draft edit saved");
      } catch (error) {
        setStatus(error.message);
      }
    });
  });

  document.querySelectorAll("button[data-regen-thread-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const threadId = button.dataset.regenThreadId;
      const selector = document.querySelector(`select[data-variant-thread-id="${threadId}"]`);
      const style = selector ? selector.value : "balanced";
      setStatus(`Regenerating ${threadId} (${style})...`);
      try {
        await regenerateDraft(threadId, style);
        await refresh();
        setStatus("Draft regenerated");
      } catch (error) {
        setStatus(error.message);
      }
    });
  });
}

async function init() {
  attachActions();
  attachConfigForm();
  attachLeadFilters();
  attachDraftFilters();
  await refresh();
}

init().catch((error) => setStatus(error.message));
