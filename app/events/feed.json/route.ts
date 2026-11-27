import { siteUpdates } from "../../site-updates";

export const dynamic = "force-static";

export function GET() {
  return Response.json(siteUpdates);
}
