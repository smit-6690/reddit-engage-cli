const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_USER_AGENT_FALLBACK = "reddit-engage-cli/0.3.0";
const VALID_SUBREDDIT_RE = /^[A-Za-z0-9_]{2,21}$/;

let cachedToken = null;

function getEnv(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function isWithinDays(createdUtcSeconds, daysBack) {
  const createdAtMs = createdUtcSeconds * 1000;
  const now = Date.now();
  const ageMs = now - createdAtMs;
  return ageMs <= daysBack * 24 * 60 * 60 * 1000;
}

function toThread(post, subreddit) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageDays = Math.max(0, Math.floor((nowSeconds - post.created_utc) / 86400));
  return {
    id: post.id,
    subreddit,
    title: post.title || "",
    body: post.selftext || "",
    upvotes: post.ups || 0,
    comments: post.num_comments || 0,
    ageDays,
    url: `https://reddit.com${post.permalink || ""}`
  };
}

function hasOAuthConfig() {
  const clientId = getEnv("REDDIT_CLIENT_ID");
  const clientSecret = getEnv("REDDIT_CLIENT_SECRET");
  const userAgent = getEnv("REDDIT_USER_AGENT");
  const username = getEnv("REDDIT_USERNAME");
  const password = getEnv("REDDIT_PASSWORD");
  const refreshToken = getEnv("REDDIT_REFRESH_TOKEN");

  const hasPasswordGrant = username && password;
  const hasRefreshGrant = refreshToken;
  return Boolean(clientId && clientSecret && userAgent && (hasPasswordGrant || hasRefreshGrant));
}

async function requestOAuthToken() {
  const clientId = getEnv("REDDIT_CLIENT_ID");
  const clientSecret = getEnv("REDDIT_CLIENT_SECRET");
  const username = getEnv("REDDIT_USERNAME");
  const password = getEnv("REDDIT_PASSWORD");
  const refreshToken = getEnv("REDDIT_REFRESH_TOKEN");

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const params = new URLSearchParams();
  if (refreshToken) {
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken);
  } else {
    params.set("grant_type", "password");
    params.set("username", username);
    params.set("password", password);
  }

  const response = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": getEnv("REDDIT_USER_AGENT", "reddit-engage-cli/0.3.0")
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Reddit OAuth token request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Reddit OAuth token missing access_token");
  }

  const expiresIn = Number(payload.expires_in || 3600);
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000
  };
  return cachedToken.value;
}

async function getOAuthToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  return requestOAuthToken();
}

async function fetchSubredditPosts(subreddit, limit) {
  const userAgent = getEnv("REDDIT_USER_AGENT", REDDIT_USER_AGENT_FALLBACK);
  let endpoint = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=${limit}`;
  const headers = { "User-Agent": userAgent };

  if (hasOAuthConfig()) {
    const token = await getOAuthToken();
    endpoint = `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/new?limit=${limit}`;
    headers.Authorization = `Bearer ${token}`;
  }

  let response = await fetch(endpoint, { headers });
  if (response.status === 401 && hasOAuthConfig()) {
    const token = await requestOAuthToken();
    headers.Authorization = `Bearer ${token}`;
    response = await fetch(endpoint, { headers });
  }

  if (!response.ok) {
    throw new Error(`Reddit fetch failed for r/${subreddit}: ${response.status}`);
  }
  const payload = await response.json();
  return (payload.data && payload.data.children ? payload.data.children : []).map((child) => child.data);
}

function isValidSubredditName(value) {
  return VALID_SUBREDDIT_RE.test(String(value || "").trim());
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

async function discoverSubreddits(query, limit = 10) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) return [];

  const userAgent = getEnv("REDDIT_USER_AGENT", REDDIT_USER_AGENT_FALLBACK);
  let endpoint = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(safeQuery)}&limit=${limit}`;
  const headers = { "User-Agent": userAgent };

  if (hasOAuthConfig()) {
    const token = await getOAuthToken();
    endpoint = `https://oauth.reddit.com/subreddits/search?q=${encodeURIComponent(safeQuery)}&limit=${limit}`;
    headers.Authorization = `Bearer ${token}`;
  }

  let response = await fetch(endpoint, { headers });
  if (response.status === 401 && hasOAuthConfig()) {
    const token = await requestOAuthToken();
    headers.Authorization = `Bearer ${token}`;
    response = await fetch(endpoint, { headers });
  }

  if (!response.ok) {
    throw new Error(`Subreddit discovery failed for query "${safeQuery}": ${response.status}`);
  }

  const payload = await response.json();
  const children = payload && payload.data && payload.data.children ? payload.data.children : [];
  return children
    .map((child) => child && child.data && child.data.display_name)
    .filter((name) => isValidSubredditName(name));
}

async function resolveTargetSubreddits(config) {
  const configured = Array.isArray(config.subreddits) ? config.subreddits : [];
  const explicitSubreddits = configured.filter((name) => isValidSubredditName(name));
  const naturalLanguageInputs = configured.filter((name) => !isValidSubredditName(name));
  const topicQueries = [];

  if (config.subredditQuery && String(config.subredditQuery).trim()) {
    topicQueries.push(String(config.subredditQuery).trim());
  }
  naturalLanguageInputs.forEach((value) => topicQueries.push(String(value).trim()));

  if (!topicQueries.length && !explicitSubreddits.length) {
    const keywordQuery = Array.isArray(config.keywords)
      ? config.keywords.filter(Boolean).slice(0, 4).join(" ")
      : "";
    if (keywordQuery.trim()) {
      topicQueries.push(keywordQuery.trim());
    }
  }

  const discovered = [];
  const shouldDiscover = config.autoDiscoverSubreddits !== false;
  const perQueryLimit = Math.max(3, Number(config.maxDiscoveredSubreddits || 8));
  if (shouldDiscover) {
    for (const query of uniqueStrings(topicQueries)) {
      try {
        const suggestions = await discoverSubreddits(query, perQueryLimit);
        discovered.push(...suggestions);
      } catch (_error) {
        // Discovery failure should not block normal scanning for explicit subreddits.
      }
    }
  }

  const all = uniqueStrings([...explicitSubreddits, ...discovered]);
  if (all.length) return all;
  return ["SaaS"];
}

async function fetchThreads(config) {
  const targetSubreddits = await resolveTargetSubreddits(config);
  const perSubredditLimit = Math.max(10, Math.ceil(config.maxThreads / Math.max(targetSubreddits.length, 1)) * 2);
  const all = [];

  for (const subreddit of targetSubreddits) {
    try {
      const posts = await fetchSubredditPosts(subreddit, perSubredditLimit);
      posts.forEach((post) => {
        if (!isWithinDays(post.created_utc, config.daysBack)) return;
        all.push(toThread(post, subreddit));
      });
    } catch (error) {
      all.push({
        id: `error-${subreddit}`,
        subreddit,
        title: `[Fetch error] Could not load r/${subreddit}`,
        body: error.message,
        upvotes: 0,
        comments: 0,
        ageDays: 0,
        url: `https://reddit.com/r/${subreddit}`
      });
    }
  }

  const filtered = all
    .filter((thread) => thread.upvotes >= config.minUpvotes)
    .filter((thread) => thread.comments >= config.minComments)
    .slice(0, config.maxThreads);

  if (filtered.length > 0) {
    return filtered;
  }

  return [
    {
      id: "fallback-1",
      subreddit: targetSubreddits[0] || "SaaS",
      title: "Any tool to automate Reddit prospecting without being spammy?",
      body: "I am looking for ways to discover relevant discussions and respond helpfully.",
      upvotes: 18,
      comments: 21,
      ageDays: 1,
      url: "https://reddit.com/r/SaaS"
    }
  ];
}

module.exports = {
  fetchThreads
};
