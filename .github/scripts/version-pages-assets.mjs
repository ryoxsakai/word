import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [rootDir, version] = process.argv.slice(2);

if (!rootDir || !version) {
  throw new Error("Usage: node version-pages-assets.mjs <directory> <version>");
}

const encodedVersion = encodeURIComponent(version);
const assetFiles = [];
const versionedPath = file => file.replace(/\.(css|js)$/, `.${encodedVersion}.$1`);
let replacementCount = 0;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath);
    } else if (entry.name.endsWith(".html")) {
      await versionHtml(entryPath);
    } else if (entry.name.endsWith(".js")) {
      await versionModuleImports(entryPath);
      assetFiles.push(entryPath);
    } else if (entry.name.endsWith(".css")) {
      assetFiles.push(entryPath);
    }
  }
}

async function replaceInFile(filePath, pattern, replacement) {
  const source = await readFile(filePath, "utf8");
  const updated = source.replace(pattern, (...args) => {
    replacementCount += 1;
    return replacement(...args);
  });
  if (updated !== source) await writeFile(filePath, updated);
}

async function versionHtml(filePath) {
  const localAsset = /(\b(?:href|src)=)(["'])(\.{1,2}\/[^"'?#]+\.(?:css|js))(?:\?v=[^"']*)?\2/g;
  await replaceInFile(filePath, localAsset, (_match, attribute, quote, assetPath) => {
    return `${attribute}${quote}${versionedPath(assetPath)}${quote}`;
  });
}

async function versionModuleImports(filePath) {
  const localModule = /(\b(?:from|import)\s+)(["'])(\.{1,2}\/[^"'?#]+\.js)(?:\?v=[^"']*)?\2/g;
  await replaceInFile(filePath, localModule, (_match, statement, quote, modulePath) => {
    return `${statement}${quote}${versionedPath(modulePath)}${quote}`;
  });
}

await walk(rootDir);

// Keep the original paths available for already-open pages.
for (const file of assetFiles) {
  await writeFile(versionedPath(file), await readFile(file));
}

if (replacementCount === 0) {
  throw new Error(`No local CSS or JavaScript references found in ${rootDir}`);
}

console.log(`Versioned ${replacementCount} asset references with ${version}`);
