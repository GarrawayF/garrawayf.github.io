import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) throw new Error("Source directory is required");

const layoutPath = path.join(root, "app", "layout.tsx");
const cssPath = path.join(root, "app", "globals.css");

let layout = fs.readFileSync(layoutPath, "utf8");

if (!layout.includes("index: false")) {
  layout = layout.replace(
    "  icons: {",
    "  robots: {\n    index: false,\n    follow: false,\n  },\n  icons: {",
  );
}

if (!layout.includes('className="preopenNotice"')) {
  layout = layout.replace(
    "      <body>{children}</body>",
    "      <body>\n        {children}\n        <div className=\"preopenNotice\" role=\"status\">\n          プレオープン｜試験公開中\n        </div>\n      </body>",
  );
}

fs.writeFileSync(layoutPath, layout);

let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes("PREOPEN_NOTICE_START")) {
  css += `\n\n/* PREOPEN_NOTICE_START */
.preopenNotice {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9999;
  padding: 9px 14px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--pink);
  color: white;
  box-shadow: 4px 4px 0 var(--ink);
  font-size: 14px;
  font-weight: 900;
  letter-spacing: .04em;
}

@media (max-width: 600px) {
  .preopenNotice {
    right: 10px;
    bottom: 10px;
    padding: 8px 11px;
    box-shadow: 3px 3px 0 var(--ink);
    font-size: 12px;
  }
}
/* PREOPEN_NOTICE_END */`;
}

fs.writeFileSync(cssPath, css);
