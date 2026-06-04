import type { Config } from "@netlify/functions";

import { runLiteratureCollectionJob } from "../../lib/literature-jobs";

export default async () => {
  const result = await runLiteratureCollectionJob();

  return Response.json(result);
};

export const config: Config = {
  schedule: "0 */6 * * *",
};
