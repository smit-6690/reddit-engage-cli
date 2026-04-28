const test = require("node:test");
const assert = require("node:assert/strict");
const { rankThreads } = require("../src/core/scorer");
const { validateDraft } = require("../src/core/compliance");

test("rankThreads sorts by highest score first", () => {
  const config = { keywords: ["tool"] };
  const threads = [
    { id: "a", title: "meme post", body: "off-topic", upvotes: 2, comments: 1, ageDays: 3 },
    { id: "b", title: "Any tool for lead gen?", body: "looking for options", upvotes: 12, comments: 6, ageDays: 1 }
  ];

  const ranked = rankThreads(threads, config);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, "b");
  assert.ok(typeof ranked[0].score === "number");
  assert.ok(Array.isArray(ranked[0].reasons));
});

test("validateDraft flags banned terms and hard pitch language", () => {
  const compliance = {
    maxWords: 120,
    bannedTerms: ["guaranteed"],
    requireSoftTone: true
  };

  const result = validateDraft("Guaranteed results. Buy now and sign up today.", compliance);
  assert.equal(result.approved, false);
  assert.ok(result.flags.some((flag) => flag.includes("banned_term:guaranteed")));
  assert.ok(result.flags.some((flag) => flag.includes("hard_pitch:buy now")));
});

test("validateDraft approves clean draft text", () => {
  const compliance = {
    maxWords: 120,
    bannedTerms: ["guaranteed"],
    requireSoftTone: true
  };

  const result = validateDraft("One practical approach is to test two keywords and share results next week.", compliance);
  assert.equal(result.approved, true);
  assert.equal(result.flags.length, 0);
});

