const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_ROOT = path.join(ROOT, "_data");

const OUTPUT_YML = path.join(DATA_ROOT, "index.yml");
const OUTPUT_JSON = path.join(DATA_ROOT, "index.json");

/**
 * All indexed sources (RELATIVE to _data/)
 */
const TARGET_FOLDERS = [
  { folder: "library", vault: "library" },
  { folder: "main", vault: "vault" },
  { folder: "vault1", vault: "vault" },
  { folder: "vault2", vault: "vault" },
  { folder: "vault3", vault: "vault" }
];

/**
 * Extract TITLE line AFTER second '---'
 * Keeps full line including "TITLE:"
 */
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

/**
 * Safe sub-vault detection:
 * firebase/_data/library/dom/LIB-001.md → dom
 * firebase/_data/vault1/x/LIB-001.md → x
 * firebase/_data/main/LIB-001.md → main
 */
function getSubVault(filePath, baseFolder) {
  const relative = path.relative(path.join(DATA_ROOT, baseFolder), filePath);
  const parts = relative.split(path.sep);

  // If file is directly inside folder
  if (parts.length === 1) return baseFolder;

  return parts[0];
}

/**
 * Scan a single markdown file
 */
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

/**
 * Recursively walk folder safely
 */
function walk(dir, vault) {
  let results = [];

  if (!fs.existsSync(dir)) {
    console.log("SKIP (missing folder):", dir);
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(walk(full, vault));
    } else if (entry.name.endsWith(".md")) {
      const subVault = getSubVault(full, path.basename(dir));
      results.push(scanFile(full, vault, subVault, entry.name));
    }
  }

  return results;
}

/**
 * MAIN
 */
function main() {
  console.log("=== SAPHAH LIBRARY INDEX BUILDER START ===");

  let all = [];

  for (const item of TARGET_FOLDERS) {
    const folderPath = path.join(DATA_ROOT, item.folder);

    console.log("Scanning:", folderPath);

    const results = walk(folderPath, item.vault);
    all = all.concat(results);
  }

  // SORT
  all.sort((a, b) => a.title.localeCompare(b.title));

  // YAML output (pipeline-friendly)
  const yaml = all.map(item => `
- vault: ${item.vault}
  sub_vault: ${item.sub_vault}
  file: ${item.file}
  title: "${item.title}"
  url: ${item.url}
`).join("\n");

  fs.writeFileSync(OUTPUT_YML, yaml, "utf8");

  // JSON output (frontend-friendly)
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(all, null, 2), "utf8");

  console.log("INDEX GENERATED:");
  console.log("- YAML:", OUTPUT_YML);
  console.log("- JSON:", OUTPUT_JSON);
  console.log("TOTAL FILES:", all.length);
  console.log("=== COMPLETE ===");
}

main();
