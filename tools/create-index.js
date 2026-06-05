const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "firebase", "_data");

const LIBRARY_DIR = path.join(ROOT, "library");
const VAULT_DIR = path.join(ROOT, "vault");

const OUTPUT_YML = path.join(ROOT, "index.yml");
const OUTPUT_JSON = path.join(ROOT, "index.json");

console.log("=== INDEX BUILDER START ===");

// ---------- HELPERS ----------
function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);

    if (fs.statSync(full).isDirectory()) {
      walk(full, results);
    } else if (file.endsWith(".md")) {
      results.push(full);
    }
  }

  return results;
}

// Extract TITLE line AFTER front matter
function extractTitle(content) {
  const lines = content.split("\n");

  let inFrontMatter = false;
  let frontMatterEnded = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // detect --- front matter blocks
    if (line === "---") {
      if (!inFrontMatter) {
        inFrontMatter = true;
      } else {
        inFrontMatter = false;
        frontMatterEnded = true;
      }
      continue;
    }

    // only start scanning after front matter ends
    if (frontMatterEnded) {
      if (line.startsWith("TITLE:")) {
        return line.replace("TITLE:", "").trim();
      }
    }
  }

  return "UNTITLED";
}

function buildEntry(filePath, baseKey) {
  const raw = fs.readFileSync(filePath, "utf8");

  const title = extractTitle(raw);

  const relative = filePath
    .replace(path.join(__dirname, "..", "firebase", "_data") + path.sep, "")
    .replace(/\\/g, "/");

  const url = `https://saphah-library.github.io/firebase/_data/${relative}`;

  const parts = relative.split("/");

  const vault = baseKey;
  const sub_vault = parts.length > 2 ? parts[1] : "root";

  return {
    vault,
    sub_vault,
    title,
    url,
  };
}

// ---------- LOAD EXISTING INDEX ----------
let existing = {};
if (fs.existsSync(OUTPUT_JSON)) {
  try {
    existing = JSON.parse(fs.readFileSync(OUTPUT_JSON, "utf8"));
  } catch (e) {
    existing = {};
  }
}

// ---------- PROCESS FILES ----------
const libraryFiles = walk(LIBRARY_DIR);
const vaultFiles = walk(VAULT_DIR);

const allEntries = [];

function process(files, vaultName) {
  for (const file of files) {
    const key = file.replace(/\\/g, "/");

    if (existing[key]) {
      console.log("SKIP (already indexed):", key);
      continue;
    }

    console.log("INDEXING:", key);

    const entry = buildEntry(file, vaultName);

    allEntries.push({
      key,
      ...entry,
    });
  }
}

process(libraryFiles, "library");
process(vaultFiles, "vault");

// ---------- MERGE ----------
for (const k in existing) {
  allEntries.push(existing[k]);
}

// ---------- BUILD OUTPUTS ----------
const indexObject = {};
for (const item of allEntries) {
  indexObject[item.key] = item;
}

// YAML (simple dump)
let yaml = "index:\n";

for (const k in indexObject) {
  const e = indexObject[k];
  yaml += `  - vault: ${e.vault}\n`;
  yaml += `    sub_vault: ${e.sub_vault}\n`;
  yaml += `    title: "${e.title}"\n`;
  yaml += `    url: "${e.url}"\n`;
}

fs.writeFileSync(OUTPUT_YML, yaml, "utf8");
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(indexObject, null, 2), "utf8");

console.log("=== INDEX COMPLETE ===");
console.log("YML:", OUTPUT_YML);
console.log("JSON:", OUTPUT_JSON);
