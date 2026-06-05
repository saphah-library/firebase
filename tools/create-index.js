const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUTPUT_YML = path.join(ROOT, "_data", "index.yml");
const OUTPUT_JSON = path.join(ROOT, "_data", "index.json");

const TARGET_FOLDERS = ["library", "vault"];

/**
 * Extract: first non-empty line AFTER second "---"
 * keeps "TITLE: ...."
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
 * Determine sub-vault safely:
 * library/dom/LIB-001.md → dom
 * vault/vault1/LIB-999.md → vault1
 */
function getSubVault(filePath, vaultRoot) {
  const relative = path.relative(path.join(ROOT, vaultRoot), filePath);
  const parts = relative.split(path.sep);
  return parts.length > 1 ? parts[0] : "main";
}

function scanFile(filePath, vault, subVault, fileName) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  const title = extractTitle(lines);

  // FIXED URL (clean GitHub Pages structure)
  const url = `https://saphah-library.github.io/firebase/${vault}/${subVault}/${fileName}`;

  return {
    vault,
    sub_vault: subVault,
    file: fileName,
    title,
    url
  };
}

function walk(dir, vault) {
  let results = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(walk(full, vault));
    } else if (entry.name.endsWith(".md")) {
      const subVault = getSubVault(full, vault);
      results.push(scanFile(full, vault, subVault, entry.name));
    }
  }

  return results;
}

function main() {
  console.log("=== SAPHAH LIBRARY INDEX BUILDER START ===");

  let all = [];

  for (const vault of TARGET_FOLDERS) {
    const folder = path.join(ROOT, vault);
    console.log("Scanning:", folder);
    all = all.concat(walk(folder, vault));
  }

  // sort BEFORE writing
  all.sort((a, b) => a.title.localeCompare(b.title));

  // YAML output
  const yml = all.map(item => `
- vault: ${item.vault}
  sub_vault: ${item.sub_vault}
  file: ${item.file}
  title: "${item.title}"
  url: ${item.url}
`).join("\n");

  fs.writeFileSync(OUTPUT_YML, yml, "utf8");

  // JSON output
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(all, null, 2), "utf8");

  console.log("INDEX GENERATED:");
  console.log("- YAML:", OUTPUT_YML);
  console.log("- JSON:", OUTPUT_JSON);
  console.log("=== COMPLETE ===");
}

main();
