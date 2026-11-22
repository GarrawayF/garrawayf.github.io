import { build } from "esbuild";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { pages: { type: "string" }, source: { type: "string" }, assets: { type: "string" }, project: { type: "string" } },
});
if (values.project) {
  const config = JSON.parse(await readFile("package.json", "utf8"));
  if (!config.boardDirectory || !["pages", "html"].includes(values.project)) throw new Error("Invalid frontend project configuration.");
  values.assets = join(config.boardDirectory, "assets");
  if (values.project === "pages") values.pages = config.boardDirectory;
  else positionals.push(join(config.boardDirectory, "discussion.html"));
}
if (positionals.length > 1 || (!positionals.length && !values.pages) || (values.source && !values.pages)) {
  throw new Error("Usage: node scripts/export-html.mjs [output.html] [--pages output-directory] [--assets image-directory] [--source frontend-source-directory]");
}

const root = process.cwd();
const imagesDir = resolve(values.assets || "public");
const apiBase = "https://shinagawa-discussion.delpiero.chatgpt.site/";
const mimeTypes = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const title = "品川アイデアボード｜X-meetup品川";
const staticEntry = `
import React from "react";
import { createRoot } from "react-dom/client";
import Board from "./app/board";
import "./app/globals.css";
const query = new URLSearchParams(location.search);
createRoot(document.getElementById("root")).render(React.createElement(Board, {
  initialRoom: query.get("room"), initialSource: location.href, initialView: query.get("view"),
  initialWrite: query.get("write"), initialTeam: query.get("team"), initialRound: query.get("round"),
  initialTab: query.get("tab")
}));`;

async function visualAssets(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) files.push(...await visualAssets(path));
    else if (item.isFile() && mimeTypes[extname(path)]) files.push(path);
  }
  return files.sort();
}

const visualFiles = await visualAssets(imagesDir);
const result = await build({
  stdin: { contents: staticEntry, resolveDir: root, loader: "tsx" },
  outfile: "discussion.js", bundle: true, metafile: true, write: false, minify: true,
  jsx: "automatic", target: ["es2022"], platform: "browser", format: "iife",
  define: { "process.env.NODE_ENV": '"production"' }, legalComments: "none",
});
const js = result.outputFiles.find(file => file.path.endsWith(".js")).text;
const css = result.outputFiles.find(file => file.path.endsWith(".css")).text;
const srcKey = filename => "/" + relative(imagesDir, filename).split(sep).join("/");
const version = text => createHash("sha256").update(text).digest("hex").slice(0, 16);

function documentHtml(head, scripts) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="x-meetup-api-base" content="${apiBase}">
<title>${title}</title>${head}
</head>
<body><div id="root"></div><noscript>投稿やメモを利用するには、ブラウザでJavaScriptを有効にしてください。</noscript>${scripts}</body>
</html>\n`;
}

if (positionals[0]) {
  const embedded = {};
  for (const file of visualFiles) {
    embedded[srcKey(file)] = "data:" + mimeTypes[extname(file)] + ";base64," + (await readFile(file)).toString("base64");
  }
  const html = documentHtml(
    `<base href="${apiBase}"><link rel="icon" href="${embedded["/favicon.svg"]}"><style>${css}</style>`,
    `<script>window.__XMEETUP_ASSETS__=${JSON.stringify(embedded)};</script><script>${js.replace(/<\/script/gi, "<\\/script")}</script>`
  );
  const target = resolve(positionals[0]);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  console.log(JSON.stringify({ singleFile: target, embeddedImages: visualFiles.length, bytes: Buffer.byteLength(html) }));
}

if (values.pages) {
  const pages = resolve(values.pages);
  const assets = join(pages, "assets");
  await mkdir(assets, { recursive: true });
  for (const file of visualFiles) {
    const target = join(assets, relative(imagesDir, file));
    if (file !== target) {
      await mkdir(dirname(target), { recursive: true });
      await copyFile(file, target);
    }
  }
  await writeFile(join(assets, "app.js"), js);
  await writeFile(join(assets, "app.css"), css);
  const html = documentHtml(
    `<meta name="x-meetup-asset-base" content="./assets/">
<link rel="icon" href="./assets/favicon.svg"><link rel="stylesheet" href="./assets/app.css?v=${version(css)}">`,
    `<script defer src="./assets/app.js?v=${version(js)}"></script>`
  );
  await writeFile(join(pages, "index.html"), html);
  console.log(JSON.stringify({ pages, visualAssets: visualFiles.length, jsBytes: Buffer.byteLength(js), cssBytes: Buffer.byteLength(css) }));
  if (values.source) await exportSource(resolve(values.source), pages);
}

async function exportSource(destination, pages) {
  // Follow browser bundle inputs plus local type-only imports. Server/API routes are outside this graph.
  const sourceFiles = new Set(Object.keys(result.metafile.inputs).filter(name => name.startsWith("app/")).map(name => resolve(root, name)));
  for (const file of sourceFiles) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    const code = await readFile(file, "utf8");
    for (const match of code.matchAll(/\bfrom\s*["'](\.\.?\/[^"']+)["']/g)) {
      const base = resolve(dirname(file), match[1]);
      const options = extname(base) ? [base] : [base + ".ts", base + ".tsx", base + ".js"];
      for (const option of options) {
        if (await stat(option).then(s => s.isFile(), () => false)) {
          sourceFiles.add(option);
          break;
        }
      }
    }
  }
  for (const file of sourceFiles) {
    const target = join(destination, relative(root, file));
    await mkdir(dirname(target), { recursive: true });
    if (target !== file) await copyFile(file, target);
  }
  const script = join(destination, "scripts/export-html.mjs");
  await mkdir(dirname(script), { recursive: true });
  if (fileURLToPath(import.meta.url) !== script) await copyFile(fileURLToPath(import.meta.url), script);

  const original = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  const packages = {};
  const runtimes = ["lucide-react", "react", "react-dom"];
  const names = new Set([...runtimes, "esbuild"]);
  // Each selected dependency in this small browser build is hoisted in its lockfile.
  for (const name of names) {
    const key = "node_modules/" + name;
    const entry = original.packages[key];
    if (!entry) throw new Error("Frontend dependency missing from lockfile: " + name);
    packages[key] = entry;
    for (const dependency of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies })) names.add(dependency);
  }
  const pinned = names => Object.fromEntries(names.map(name => [name, packages["node_modules/" + name].version]));
  const pagesPath = relative(destination, pages).split(sep).join("/");
  const metadata = { name: "x-meetup-shinagawa-board", version: "1.0.0", private: true, type: "module",
    engines: { node: ">=22.13" }, boardDirectory: pagesPath,
    scripts: { build: "node scripts/export-html.mjs --project pages", "build:html": "node scripts/export-html.mjs --project html" },
    dependencies: pinned(runtimes), devDependencies: pinned(["esbuild"]) };
  const lock = {
    name: metadata.name, version: metadata.version, lockfileVersion: 3, requires: true,
    packages: { "": { name: metadata.name, version: metadata.version, engines: metadata.engines,
      dependencies: metadata.dependencies, devDependencies: metadata.devDependencies }, ...packages },
  };
  await writeFile(join(destination, "package.json"), JSON.stringify(metadata, null, 2) + "\n");
  await writeFile(join(destination, "package-lock.json"), JSON.stringify(lock, null, 2) + "\n");
  const readme = `# X-meetup品川 ディスカッションアプリ

このフォルダーに画面のソースを、${pagesPath}/assets/ にスライド・QR画像を置いています。画像はそのまま配信とビルドの両方に使います。

Node.js 22.13以降でこのフォルダーを開き、初回に \`npm ci\`、画面を変更したら \`npm run build\` を実行してください。隣の \`${pagesPath}/index.html\` と \`${pagesPath}/assets/app.js\`、\`app.css\` が更新されます。単体で配布する場合は \`npm run build:html\` で \`${pagesPath}/discussion.html\` を生成します。

公開ページの \`?room=demo\` は練習用です。画面・画像はGitHub Pagesで配信し、投稿やコメントの保存・同期には既存のWorkerを使います。
`;
  await writeFile(join(destination, "README.md"), readme);
  console.log(JSON.stringify({ source: destination, applicationFiles: sourceFiles.size, lockedPackages: names.size }));
}
