const { readJson, writeJson } = require("./storage");

const REVIEW_FILE = "review-status.json";

function getReviewMap() {
  return readJson(REVIEW_FILE, {});
}

function updateReviewStatus(threadId, status) {
  const map = getReviewMap();
  map[threadId] = {
    status,
    updatedAt: new Date().toISOString()
  };
  writeJson(REVIEW_FILE, map);
  return map[threadId];
}

module.exports = {
  getReviewMap,
  updateReviewStatus
};
