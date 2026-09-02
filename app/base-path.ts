export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const withBasePath = (path: string) =>
  path.startsWith("/") ? `${BASE_PATH}${path}` : path;
