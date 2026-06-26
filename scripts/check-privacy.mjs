import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scannedRoots = ["src", "scripts", "tools"].map((name) => path.join(rootDir, name));
const scannerFile = path.join(rootDir, "scripts/check-privacy.mjs");
const allowedUrls = new Set(["https://discord.com/channels/*"]);
const blockedPatterns = [
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bsendBeacon\b/,
  /\blocalStorage\b/,
  /\bindexedDB\b/,
  /\bdocument\.cookie\b/,
  /\bcookies\b/i,
  /\btoken\b/i,
  /\bauthorization\b/i,
  /\bexecuteScript\b/,
  /\beval\s*\(/,
  /\bnew\s+Function\b/,
  /\binnerHTML\b/,
  /\bdiscord\.com\/api\b/i,
  /\bapi\/v\d+\b/i,
  /\banalytics\b/i,
  /\btelemetry\b/i
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkUrls(relativePath, source) {
  const urls = source.match(/https?:\/\/[^\s"'`]+/g) || [];
  return urls
    .filter((url) => !allowedUrls.has(url))
    .map((url) => `${relativePath}: unexpected external URL ${url}`);
}

async function scanFile(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  const source = await readFile(filePath, "utf8");
  const failures = [];

  for (const pattern of blockedPatterns) {
    if (pattern.test(source)) {
      failures.push(`${relativePath}: blocked source pattern ${pattern}`);
    }
  }

  failures.push(...checkUrls(relativePath, source));
  return failures;
}

const failures = [];
for (const directory of scannedRoots) {
  if ((await stat(directory)).isDirectory()) {
    const files = await collectFiles(directory);
    for (const file of files) {
      if (file === scannerFile) {
        continue;
      }
      failures.push(...await scanFile(file));
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Privacy/static check passed.");
