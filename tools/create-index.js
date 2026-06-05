const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_ROOT = path.join(ROOT, "_data");

const OUTPUT_YML = path.join(DATA_ROOT, "index.yml");
const OUTPUT_JSON = path.join(DATA_ROOT, "index.json");
const STATE_FILE = path.join(DATA_ROOT, "librarian_state.json");

const TARGET_FOLDERS = [
  { folder: "library", vault: "library" },
  { folder: "main", vault: "vault" },
  { folder: "vault1", vault: "vault" },
  { folder: "vault2", vault: "vault" },
  { folder: "vault3", vault: "vault" }
];

/* ---------------- STATE ---------------- */
function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      version: 1,
      created: new Date().toISOString(),
      last_run: null,
      indexed: {}
    };
  }

  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/* ---------------- TITLE ---------------- */
function extractTitle(lines) {
  let dashCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") dashCount++;

    if (dashCount === 2) {
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.length > 0) return line;
      }
    }
  }

  return "TITLE: UNKNOWN";
}

/* ---------------- KEY ---------------- */
function makeKey(vault, subVault, file) {
  return `${vault}/${subVault}/${file}`;
}

/* ---------------- SUBVAULT ---------------- */
function getSubVault(filePath, baseFolder) {
  const relative = path.relative(path.join(DATA_ROOT, baseFolder), filePath);
  const parts = relative.split(path.sep);

  if (parts.length === 1) return baseFolder;
  return parts[0];
}

/* ---------------- SCAN ---------------- */
function scanFile(filePath, vault, subVault, fileName) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  const title = extractTitle(lines);

  const url = `https://saphah-library.github.io/firebase/_data/${vault}/${subVault}/${fileName}`;

  return {
    vault,
    sub_vault: subVault,
    file: fileName,
    title,
    url
  };
}

/* ---------------- WALK ---------------- */
function walk(dir, vault, existingSet, newItems) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full, vault, existingSet, newItems);
    } else if (entry.name.endsWith(".md")) {
      const subVault = getSubVault(full, path.basename(dir));
      const key = makeKey(vault, subVault, entry.name);

      if (existingSet.has(key)) continue;

      const item = scanFile(full, vault, subVault, entry.name);
      item._key = key;

      newItems.push(item);
    }
  }
}

/* ---------------- MAIN ---------------- */
function main() {
  console.log("=== INCREMENTAL INDEX BUILDER START ===");

  let state = loadState();
  let existingSet = new Set(Object.keys(state.indexed || {}));

  let newItems = [];

  // existing index
  let allItems = Object.values(state.indexed || {});

  for (const item of TARGET_FOLDERS) {
    const folderPath = path.join(DATA_ROOT, item.folder);
    console.log("Scanning:", folderPath);
    walk(folderPath, item.vault, existingSet, newItems);
  }

  console.log("NEW FILES FOUND:", newItems.length);

  // update state
  for (const item of newItems) {
    state.indexed[item._key] = {
      vault: item.vault,
      sub_vault: item.sub_vault,
      file: item.file,
      title: item.title,
      url: item.url
    };
  }

  // 🔥 IMPORTANT ADDITION
  state.last_run = new Date().toISOString();

  saveState(state);

  // rebuild full dataset
  allItems = Object.values(state.indexed);

  allItems.sort((a, b) => a.title.localeCompare(b.title));

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(allItems, null, 2));

  // append YAML only for new
  if (newItems.length > 0) {
    const yamlAppend = newItems.map(item => `
- vault: ${item.vault}
  sub_vault: ${item.sub_vault}
  file: ${item.file}
  title: "${item.title}"
  url: ${item.url}
`).join("\n");

    fs.appendFileSync(OUTPUT_YML, "\n" + yamlAppend);
  }

  console.log("STATE UPDATED + INDEX REBUILT");
  console.log("LAST RUN:", state.last_run);
  console.log("TOTAL FILES:", allItems.length);
  console.log("=== COMPLETE ===");
}

main();
