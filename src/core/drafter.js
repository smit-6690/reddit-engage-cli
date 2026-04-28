const { generateText } = require("./llm");
const { validateDraft } = require("./compliance");

function buildFallbackDraft(thread, config) {
  const intro = `This is a common challenge in r/${thread.subreddit}, and your approach is already on the right track.`;
  const insight = `A practical workflow is to define a few buyer-intent phrases, shortlist recent threads with active discussion, and reply with concrete next steps instead of promotion.`;
  const softMention = `If it helps, ${config.brandName} is built for this: ${config.brandSummary}`;
  const close = `If you want, I can share a simple checklist you can run in 10 minutes per day.`;

  return [intro, insight, softMention, close].join(" ");
}

function buildPrompt(thread, config, style = "balanced") {
  const styleGuidance = {
    balanced: "Balanced: practical and concise.",
    tactical: "Tactical: give concrete implementation steps.",
    educational: "Educational: explain rationale and best practice.",
    short: "Short-form: 2-3 sentences max."
  };
  return [
    "Write one Reddit reply draft.",
    `Style: ${styleGuidance[style] || styleGuidance.balanced}`,
    `Tone: ${config.voice}`,
    "Rules:",
    "- Be helpful and specific to the exact thread",
    "- No hard selling",
    "- Under 120 words",
    "- Avoid hype claims",
    "- Do not invent tool names, brands, or personal usage claims",
    "- Do not use generic filler like 'I've found X helpful'",
    "- Give one concrete workflow tip and one optional soft mention",
    "",
    `Brand: ${config.brandName}`,
    `Brand context: ${config.brandSummary}`,
    "",
    `Thread title: ${thread.title}`,
    `Thread body: ${thread.body}`,
    "",
    "Return only the reply text."
  ].join("\n");
}

function sanitizeDraftText(text) {
  return text.replace(/^"+|"+$/g, "").replace(/\s+/g, " ").trim();
}

function needsFallback(draftText) {
  const lower = draftText.toLowerCase();
  const badPatterns = [
    "i've found",
    "helpful for automating",
    "poll everywhere",
    "sentilink",
    "hypestream"
  ];
  return badPatterns.some((pattern) => lower.includes(pattern));
}

async function buildDraft(thread, config, style = "balanced") {
  let draftText = "";
  let source = "llm";
  try {
    draftText = sanitizeDraftText(await generateText(buildPrompt(thread, config, style), config.llm));
    if (!draftText) {
      throw new Error("Empty LLM response");
    }
    if (needsFallback(draftText)) {
      throw new Error("Low-quality generic draft");
    }
  } catch (_error) {
    source = "fallback-template";
    draftText = sanitizeDraftText(buildFallbackDraft(thread, config));
  }

  const compliance = validateDraft(draftText, config.compliance);

  return {
    threadId: thread.id,
    threadUrl: thread.url,
    title: thread.title,
    draft: draftText,
    source,
    guardrails: [
      "No fake claims",
      "No hard CTA",
      "Lead with value",
      "Keep under 120 words"
    ],
    compliance,
    style
  };
}

async function createDrafts(rankedThreads, config, limit = 5) {
  const selected = rankedThreads.slice(0, limit);
  const drafts = [];
  const styles = ["balanced", "tactical", "educational", "short"];
  for (const thread of selected) {
    const draft = await buildDraft(thread, config, "balanced");
    const variants = styles.map((style) => ({ style }));
    drafts.push(draft);
    draft.variants = variants;
  }
  return drafts;
}

module.exports = {
  createDrafts,
  buildDraft
};
