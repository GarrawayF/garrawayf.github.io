import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) throw new Error("Output directory is required");

const style = `<style id="preopen-notice-style">
.preopenNotice{position:fixed;right:16px;bottom:16px;z-index:9999;padding:9px 14px;border:2px solid #08090b;border-radius:999px;background:#ff2d86;color:#fff;font-family:"Noto Sans JP",sans-serif;font-size:13px;font-weight:900;letter-spacing:.04em;box-shadow:4px 4px 0 #08090b}
@media(max-width:600px){.preopenNotice{right:10px;bottom:10px;padding:8px 11px;font-size:11px;box-shadow:3px 3px 0 #08090b}}
</style>`;
const notice = `<div class="preopenNotice" role="status">プレオープン｜試験公開中</div>`;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      let html = fs.readFileSync(target, "utf8");
      if (!html.includes("preopenNotice")) {
        html = html.replace("</head>", style + "</head>");
        html = html.replace(/(<body[^>]*>)/, "$1" + notice);
        fs.writeFileSync(target, html);
      }
    }
  }
}
walk(root);
