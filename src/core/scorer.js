const INTENT_TERMS = [
  "looking for",
  "recommend",
  "any tool",
  "how are you",
  "need",
  "struggling",
  "help",
  "best way",
  "workflow"
];

const NEGATIVE_TERMS = ["meme", "shitpost", "off-topic", "rant"];

function scoreThread(thread, config) {
  const text = `${thread.title} ${thread.body}`.toLowerCase();
  const keywordHits = config.keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
  const intentHits = INTENT_TERMS.filter((term) => text.includes(term)).length;
  const negativeHits = NEGATIVE_TERMS.filter((term) => text.includes(term)).length;
  const questionSignal = thread.title.includes("?") ? 1 : 0;
  const recencyBonus = Math.max(0, 7 - thread.ageDays) * 1.5;

  const score =
    keywordHits * 24 +
    intentHits * 14 +
    questionSignal * 8 +
    Math.min(thread.upvotes, 50) * 0.5 +
    Math.min(thread.comments, 50) * 0.9 +
    recencyBonus -
    negativeHits * 20;

  return {
    ...thread,
    score: Number(score.toFixed(2)),
    reasons: [
      `keyword_hits:${keywordHits}`,
      `intent_hits:${intentHits}`,
      `question_signal:${questionSignal}`,
      `negative_hits:${negativeHits}`,
      `upvotes:${thread.upvotes}`,
      `comments:${thread.comments}`,
      `recency_bonus:${recencyBonus.toFixed(1)}`
    ]
  };
}

function rankThreads(threads, config) {
  return threads.map((thread) => scoreThread(thread, config)).sort((a, b) => b.score - a.score);
}

module.exports = {
  rankThreads
};
