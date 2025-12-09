import {
  ChatInputCommandInteraction,
  type Interaction,
  type InteractionReplyOptions,
  Message,
  MessageFlags,
} from "discord.js";
import { logger, replacements } from "./env.js";

export async function handleMessage(message: Message) {
  if (message.author.bot || !message.guildId || !message.channel.isSendable()) {
    return;
  }

  const map = await replacements.get(message.guildId);

  const user = Object.keys(map).find((id) => message.mentions.users.has(id));
  if (!user || !map[user]) return;

  try {
    await message.delete();

    const content = message.content.replace(
      new RegExp(`<@!?${user}>`, "g"),
      map[user],
    );

    await message.channel.send({
      content: `**${message.author.username}:** ${content}`,
      files: message.attachments.map((x) => x.url),
    });

    logger.debug(`replaced mention from ${message.author.tag}`);
  } catch (error) {
    logger.error("failed to process message:", error);
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction<"cached">) {
  const target = interaction.options.getUser("target", true);
  const text = interaction.options.getString("replacement", true);

  await replacements.add(interaction.guildId, target.id, text);
  await interaction.reply({
    content: `✅ Mentions for ${target} will now be replaced with '${text}'`,
    flags: MessageFlags.Ephemeral,
  });

  logger.info(`set replacement for ${target.tag}: '${text}'`);
}

async function handleRemove(
  interaction: ChatInputCommandInteraction<"cached">,
) {
  const target = interaction.options.getUser("target", true);
  const removed = await replacements.remove(interaction.guildId, target.id);

  if (!removed) {
    await interaction.reply({
      content: `❌ No replacement configured for ${target}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: `✅ Removed replacement for ${target}`,
    flags: MessageFlags.Ephemeral,
  });

  logger.info(`removed replacement for ${target.tag}`);
}

async function handleList(interaction: ChatInputCommandInteraction<"cached">) {
  const map = await replacements.get(interaction.guildId);
  const entries = Object.entries(map);

  if (entries.length === 0) {
    await interaction.reply({
      content: "No replacements configured.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const list = entries
    .map(([user, text]) => `- <@${user}> → "${text}"`)
    .join("\n");

  await interaction.reply({
    content: `**Configured Replacements:**\n${list}`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleInteraction(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || !interaction.guildId) return;
  if (interaction.commandName !== "correct") return;

  await interaction.guild?.fetch();
  if (!interaction.inCachedGuild()) return;

  try {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "add":
        await handleAdd(interaction);
        break;
      case "rm":
        await handleRemove(interaction);
        break;
      case "ls":
        await handleList(interaction);
        break;
    }
  } catch (error) {
    logger.error("command error:", error);

    const reply: InteractionReplyOptions = {
      content: "❌ An error occurred while processing the command.",
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred)
      await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
}
