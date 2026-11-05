import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { ensureBuckets } from "./storage/index.js";

await ensureBuckets();
createApp().listen(config.PORT, "0.0.0.0", () =>
  logger.info(`API escuchando en :${config.PORT}`),
);