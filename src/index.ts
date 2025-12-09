import { Client, Events, GatewayIntentBits } from "discord.js";

import { handleInteraction, handleMessage } from "./handlers";
import { registerCommands } from "./commands";
import { config, logger } from "./env";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client
  .once(Events.ClientReady, async (ready) => {
    logger.info(`logged in as ${ready.user.tag}`);
    await registerCommands(ready.user.id);
  })
  .on(Events.InteractionCreate, handleInteraction)
  .on(Events.MessageCreate, handleMessage);

process.on("unhandledRejection", (error) => {
  logger.error("unhandled:", error);
});

await client.login(config.token);
