export const publicBoardUrl = "https://garrawayf.github.io/meetups/shinagawa-1124-76c6673b54a55e47010a67a8/board/";
export const boardApiUrl = "https://shinagawa-discussion.delpiero.chatgpt.site/";

export type BoardView = "personal" | "summary" | "screen";

export function boardViewOf(view?: string | null, write?: string | null, hash = ""): BoardView {
  if (view === "screen") return "screen";
  if (view === "summary" || write === "team" || write === "plenary" || write === "edit" || hash === "#round-summary-sheet") return "summary";
  return "personal";
}

export function isDemoRoom(source?: string | URL): boolean {
  const address = source ?? (typeof window === "undefined" ? "" : window.location.href);
  return new URL(address || publicBoardUrl, publicBoardUrl).searchParams.get("room") === "demo";
}

export function preserveBoardRoom(url: URL, source?: string | URL): URL {
  if (isDemoRoom(source)) url.searchParams.set("room", "demo");
  else url.searchParams.delete("room");
  return url;
}

/** Static pages and downloaded copies use the event's existing shared database. */
export function roomApi(path: string): string {
  const address = new URL(window.location.href);
  const configured = document.querySelector<HTMLMetaElement>('meta[name="x-meetup-api-base"]')?.content;
  const staticPage = address.origin === new URL(publicBoardUrl).origin || address.protocol === "file:";
  const base = configured || (staticPage ? boardApiUrl : document.baseURI);
  return preserveBoardRoom(new URL(path, base), address).href;
}

/** Existing event-day keys stay valid when the room parameter is absent. */
export function roomStorageKey(key: string): string {
  return isDemoRoom() ? key + ":demo" : key;
}

export function pageLink(source: string, params: Record<string, string> = {}, hash = ""): string {
  const page = new URL(source || publicBoardUrl, publicBoardUrl);
  page.search = "";
  page.hash = hash;
  preserveBoardRoom(page, source);
  for (const [key, value] of Object.entries(params)) if (value) page.searchParams.set(key, value);
  return source && !source.startsWith("?") ? page.href : (page.search || (hash ? "" : "?")) + page.hash;
}

type PagesAccess = { request: (url: string, init?: RequestInit) => Promise<Response> };
export function roomFetch(url: string, init?: RequestInit) {
  const access = (window as Window & { __XMEETUP_ACCESS__?: PagesAccess }).__XMEETUP_ACCESS__;
  return access ? access.request(url,init) : fetch(url,init);
}
