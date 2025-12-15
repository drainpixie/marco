import { createServer } from "node:http";

import { Client, Events, GatewayIntentBits } from "discord.js";

import { handleInteraction, handleMessage } from "./handlers.js";
import { registerCommands } from "./commands.js";
import { config, logger } from "./env.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const server = createServer((req, res) => {
  if (req.url !== "/health") {
    res.write(404);
    res.end();

    return;
  }

  const ok = client.ws.status === 0;

  res.writeHead(ok ? 200 : 500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok }));
});

client
  .once(Events.ClientReady, async (ready) => {
    logger.info(`logged in as ${ready.user.tag}`);
    await registerCommands(ready.user.id);

    server.listen(config.port, () =>
      logger.info(`listening on port ${config.port}`),
    );
  })
  .on(Events.InteractionCreate, handleInteraction)
  .on(Events.MessageCreate, handleMessage);

await client.login(config.token);

process.on("unhandledRejection", (error) => {
  logger.error("unhandled:", error);
});
