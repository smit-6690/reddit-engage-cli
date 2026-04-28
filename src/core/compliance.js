function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function validateDraft(draft, compliance) {
  const normalized = draft.replace(/^"+|"+$/g, "").trim();
  const text = normalized.toLowerCase();
  const flags = [];
  const suspiciousToolClaims = ["sentilink", "hypestream", "poll everywhere"];

  if (countWords(normalized) > compliance.maxWords) {
    flags.push(`too_long:${countWords(normalized)}>${compliance.maxWords}`);
  }

  for (const term of compliance.bannedTerms) {
    if (text.includes(term.toLowerCase())) {
      flags.push(`banned_term:${term}`);
    }
  }

  if (compliance.requireSoftTone) {
    const hardPitchPhrases = ["buy now", "book a demo", "dm me", "sign up today"];
    for (const phrase of hardPitchPhrases) {
      if (text.includes(phrase)) {
        flags.push(`hard_pitch:${phrase}`);
      }
    }
  }

  for (const tool of suspiciousToolClaims) {
    if (text.includes(tool)) {
      flags.push(`unverified_tool_claim:${tool}`);
    }
  }

  if (text.includes("i've found") && text.includes("helpful")) {
    flags.push("generic_claim_language");
  }

  return {
    approved: flags.length === 0,
    flags
  };
}

module.exports = {
  validateDraft
};
