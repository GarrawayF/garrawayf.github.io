import content from "../content/site-updates.json";
import { siteUpdatesSchema } from "./site-updates-schema";

export const siteUpdates = siteUpdatesSchema.parse(content);
export const listingBuildTime = Date.now();
