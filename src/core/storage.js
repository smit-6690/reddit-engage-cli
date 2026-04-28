const fs = require("fs");
const path = require("path");
const { DATA_DIR } = require("./config");

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function writeJson(name, data) {
  const target = filePath(name);
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson(name, fallback = null) {
  const target = filePath(name);
  if (!fs.existsSync(target)) return fallback;
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

module.exports = {
  writeJson,
  readJson
};
