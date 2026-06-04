import type { Config } from "@netlify/functions";

import { runRssCollectionJob } from "../../lib/literature-jobs";

export default async () => {
  const result = await runRssCollectionJob();

  return Response.json(result);
};

export const config: Config = {
  schedule: "@hourly",
};
