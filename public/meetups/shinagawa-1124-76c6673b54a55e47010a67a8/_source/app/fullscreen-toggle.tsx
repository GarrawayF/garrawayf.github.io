"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import "./fullscreen-toggle.css";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void | Promise<void>;
};
type FullscreenRoot = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};

function active() {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

function message(blocked: boolean) {
  const desktop = window.matchMedia("(min-width: 900px) and (pointer: fine)").matches;
  const text = blocked ? "ブラウザーの全画面表示に切り替えられませんでした。" : "このブラウザーでは全画面表示を利用できません。";
  return desktop ? text + " F11でも試せます。" : text;
}

export default function FullscreenToggle({ where }: { where: "topbar" | "detail" }) {
  const [enabled, setEnabled] = useState(false);
  const [feedback, setFeedback] = useState("");
  const requesting = useRef(false);
  useEffect(() => {
    const update = () => { requesting.current = false; setEnabled(active()); setFeedback(""); };
    const failure = () => {
      if (requesting.current) { requesting.current = false; setFeedback(message(true)); }
    };
    update();
    for (const event of ["fullscreenchange","webkitfullscreenchange"]) document.addEventListener(event,update);
    for (const event of ["fullscreenerror","webkitfullscreenerror"]) document.addEventListener(event,failure);
    return () => {
      requesting.current = false;
      for (const event of ["fullscreenchange","webkitfullscreenchange"]) document.removeEventListener(event,update);
      for (const event of ["fullscreenerror","webkitfullscreenerror"]) document.removeEventListener(event,failure);
    };
  },[]);

  async function toggle() {
    const doc = document as FullscreenDocument;
    const root = doc.documentElement as FullscreenRoot;
    const isActive = active();
    const host = isActive ? doc : root;
    const method = isActive ? doc.exitFullscreen ?? doc.webkitExitFullscreen : root.requestFullscreen ?? root.webkitRequestFullscreen;
    const allowed = root.requestFullscreen ? doc.fullscreenEnabled : doc.webkitFullscreenEnabled;
    setFeedback("");
    if (!method || (!isActive && allowed === false)) { setFeedback(message(false)); return; }
    if (requesting.current) return;
    requesting.current = true;
    try {
      // Invoke directly from the click; browser transient user activation is required.
      const result = method.call(host as never);
      if (result) { await result; requesting.current = false; setEnabled(active()); }
    } catch {
      requesting.current = false;
      setFeedback(message(true));
    }
  }

  const label = enabled ? "全画面を終了" : "全画面";
  return <span className={"x-fullscreen x-fullscreen-" + where}>
    <button type="button" className="x-fullscreen-button" aria-label={label} title={label}
      aria-pressed={enabled} onClick={toggle}>
      {enabled ? <Minimize size={17} aria-hidden="true"/> : <Maximize size={17} aria-hidden="true"/>}
      <span>{label}</span>
    </button>
    <span className="x-fullscreen-notice" role="status">{feedback}</span>
  </span>;
}
