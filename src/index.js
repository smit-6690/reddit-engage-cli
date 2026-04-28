#!/usr/bin/env node

const { initProject, runScan, runRank, runDraft, runExport, runAll } = require("./core/pipeline");

function printHelp() {
  console.log(`
Reddit-Engage-CLI (v0.1.0)

Usage:
  node src/index.js <command>

Commands:
  init      Create engage.config.json with defaults
  scan      Collect thread candidates into data/threads.raw.json
  rank      Score and rank candidates into data/threads.ranked.json
  draft     Generate helpful drafts into data/drafts.json
  export    Export markdown review queue to data/review-queue.md
  all       Run scan -> rank -> draft -> export
`);
}

function commandInit() {
  const result = initProject();
  console.log(`Config ready at ${result.configPath}`);
  console.log(`Tracked subreddits: ${result.subreddits.join(", ")}`);
}

async function commandScan() {
  const result = await runScan();
  console.log(`Saved ${result.count} candidate threads to ${result.output}`);
}

function commandRank() {
  const result = runRank();
  if (result.message) {
    console.log(result.message);
    return;
  }
  console.log(`Ranked ${result.count} threads. Top score: ${result.topScore}`);
}

async function commandDraft() {
  const result = await runDraft();
  if (result.message) {
    console.log(result.message);
    return;
  }
  console.log(`Created ${result.count} drafts in ${result.output}`);
}

function commandExport() {
  const result = runExport();
  if (result.message) {
    console.log(result.message);
    return;
  }
  console.log(`Exported review queue to ${result.output}`);
}

async function commandAll() {
  const result = await runAll();
  console.log(`Saved ${result.scan.count} candidate threads to ${result.scan.output}`);
  if (result.rank.message) {
    console.log(result.rank.message);
  } else {
    console.log(`Ranked ${result.rank.count} threads. Top score: ${result.rank.topScore}`);
  }
  if (result.draft.message) {
    console.log(result.draft.message);
  } else {
    console.log(`Created ${result.draft.count} drafts in ${result.draft.output}`);
  }
  if (result.export.message) {
    console.log(result.export.message);
  } else {
    console.log(`Exported review queue to ${result.export.output}`);
  }
}

async function main() {
  const cmd = process.argv[2];

  switch (cmd) {
    case "init":
      commandInit();
      break;
    case "scan":
      await commandScan();
      break;
    case "rank":
      commandRank();
      break;
    case "draft":
      await commandDraft();
      break;
    case "export":
      commandExport();
      break;
    case "all":
      await commandAll();
      break;
    default:
      printHelp();
  }
}

main().catch((error) => {
  console.error(`Command failed: ${error.message}`);
  process.exitCode = 1;
});
