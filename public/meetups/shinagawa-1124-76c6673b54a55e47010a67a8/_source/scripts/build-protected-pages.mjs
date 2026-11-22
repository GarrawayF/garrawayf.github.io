import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const {values}=parseArgs({ options:{out:{type:"string"},assets:{type:"string"}} });
if(!values.out||!values.assets){
  console.error("Usage: node scripts/build-protected-pages.mjs --out <fresh-directory> --assets <public-artwork-directory>");
  process.exit(1);
}
const output=resolve(values.out), input=resolve(values.assets);
const existing=await readdir(output).catch(error=>{if(error.code==="ENOENT")return [];throw error;});
if(existing.length)throw new Error("Use a fresh output directory; this prevents retaining old public slide images.");
const publicFiles=await readdir(input,{withFileTypes:true});
const temp=await mkdtemp(join(tmpdir(),"xmeetup-public-"));
try {
  // The allow-list intentionally excludes both slide export folders and private manifests.
  for(const entry of publicFiles){
    if(entry.isFile() && /^(?:favicon|join(?:-demo)?(?:-[A-E]|-qr))\.svg$/u.test(entry.name)){
      await cp(join(input,entry.name),join(temp,entry.name));
    }else if(entry.isDirectory()&&entry.name==="scene-photos"){
      await mkdir(join(temp,entry.name));
      for(const image of await readdir(join(input,entry.name),{withFileTypes:true})) {
        if(image.isFile()&&/^[\w-]+\.(?:webp|jpg|png|svg)$/iu.test(image.name))await cp(join(input,entry.name,image.name),join(temp,entry.name,image.name));
      }
    }
  }
  const result=spawnSync(process.execPath,[join(root,"scripts","export-html.mjs"),"--pages",join(output,"board"),"--assets",temp],{cwd:root,stdio:"inherit"});
  if(result.status!==0)throw new Error("Board build failed");
  const access=await readFile(join(root,"pages","access.js"),"utf8");
  const version=createHash("sha256").update(access).digest("hex").slice(0,16);
  await writeFile(join(output,"access.js"),access);
  const cover="<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>X-meetup 品川｜参加者入口</title></head><body></body></html>";
  const gate=await readFile(join(root,"pages","gate.html"),"utf8");
  const style=await readFile(join(root,"pages","gate-style.html"),"utf8");
  for(const [filename,type,script] of [
    [join(output,"index.html"),"cover","./access.js"],
    [join(output,"board","index.html"),"board","../access.js"],
  ]){
    let html=type==="cover"?cover:await readFile(filename,"utf8");
    html=html.replace("</head>",`<meta name="referrer" content="no-referrer">${style}</head>`)
      .replace("<body>",`<body data-event-page="${type}">${gate}<template id="event-content">`)
      .replace("</body>",`</template><script defer src="${script}?v=${version}"></script></body>`);
    if(!html.includes('template id="event-content"'))throw new Error("Access wrapper missing");
    await writeFile(filename,html);
  }
}finally{await rm(temp,{recursive:true,force:true});}
