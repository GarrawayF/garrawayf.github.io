/** Resolve shared artwork in the Worker app, a Pages subdirectory or the portable file. */
export function assetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const bundled = (window as Window & { __XMEETUP_ASSETS__?: Record<string, string> }).__XMEETUP_ASSETS__;
  if (bundled?.[path]) return bundled[path];
  const base = document.querySelector<HTMLMetaElement>('meta[name="x-meetup-asset-base"]')?.content;
  return base ? new URL(path.replace(/^\/+/u, ""), new URL(base, window.location.href)).href : path;
}
