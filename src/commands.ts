import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config, logger } from "./env.js";

export const command = new SlashCommandBuilder()
  .setName("correct")
  .setDescription("Manage mention replacements")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a mention replacement")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("User whose mentions should be replaced")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("replacement")
          .setDescription("Text to replace mentions with")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("rm")
      .setDescription("Remove a mention replacement")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("User to stop replacing")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("ls").setDescription("List all configured replacements"),
  );

export async function registerCommands(id: string) {
  const rest = new REST().setToken(config.token);
  const body = [command].map((cmd) => cmd.toJSON());
  const scoped = logger.scope("rest");

  try {
    scoped.info("registering commands");
    await rest.put(Routes.applicationCommands(id), { body });
    scoped.info("commands registered");
  } catch (error) {
    scoped.error(error);
  }
}
