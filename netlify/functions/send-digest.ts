import type { Config } from "@netlify/functions";

import { runDigestMarkJob } from "../../lib/literature-jobs";

export default async () => {
  const result = await runDigestMarkJob();

  return Response.json(result);
};

export const config: Config = {
  schedule: "0 0 * * *",
};
