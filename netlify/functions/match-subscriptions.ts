import type { Config } from "@netlify/functions";

import { runSubscriptionMatchJob } from "../../lib/literature-jobs";

export default async () => {
  const result = await runSubscriptionMatchJob({ sinceHours: 72 });

  return Response.json(result);
};

export const config: Config = {
  schedule: "@hourly",
};
