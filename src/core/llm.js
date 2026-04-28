function getTimeoutMs(llmConfig) {
  const parsed = Number(llmConfig && llmConfig.timeoutMs);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 4000;
  }
  return parsed;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`LLM request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOllama(prompt, llmConfig) {
  const endpoint = `${llmConfig.baseUrl.replace(/\/$/, "")}/api/generate`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: llmConfig.model,
      prompt,
      stream: false
    })
  }, getTimeoutMs(llmConfig));
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }
  const payload = await response.json();
  return (payload.response || "").trim();
}

async function callOpenRouter(prompt, llmConfig) {
  if (!llmConfig.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY missing in config");
  }
  const endpoint = `${llmConfig.openRouterBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmConfig.openRouterApiKey}`
    },
    body: JSON.stringify({
      model: llmConfig.openRouterModel,
      messages: [{ role: "user", content: prompt }]
    })
  }, getTimeoutMs(llmConfig));
  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.status}`);
  }
  const payload = await response.json();
  return (payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : ""
  ).trim();
}

async function generateText(prompt, llmConfig) {
  if (llmConfig.provider === "openrouter") {
    return callOpenRouter(prompt, llmConfig);
  }
  return callOllama(prompt, llmConfig);
}

module.exports = {
  generateText
};
