type GalleryTarget = { kind: "idea" | "theme"; id: string };

const stateKey = "xMeetupGalleryEntry";

type GalleryEntry = { parent: "list" | "detail"; scrollTop: number };

export function galleryEntry(state: unknown): GalleryEntry | null {
  if (!state || typeof state !== "object") return null;
  const entry = (state as Record<string, unknown>)[stateKey] as GalleryEntry | undefined;
  if (!entry || (entry.parent !== "list" && entry.parent !== "detail") || !Number.isFinite(entry.scrollTop)) return null;
  return entry;
}

export function galleryHistoryState(state: unknown, entry: GalleryEntry | null) {
  const next = state && typeof state === "object" ? { ...state } as Record<string, unknown> : {};
  if (entry) next[stateKey] = entry;
  else delete next[stateKey];
  return next;
}

export function galleryLocation(source: string, target?: GalleryTarget): URL {
  const url = new URL(source);
  url.searchParams.delete("idea");
  url.searchParams.delete("thread");
  if (url.hash.startsWith("#theme-")) url.hash = "";
  if (target) {
    url.searchParams.set("view", "screen");
    if (target.kind === "theme") url.hash = "theme-" + target.id;
    else url.searchParams.set("idea", target.id);
  }
  return url;
}
