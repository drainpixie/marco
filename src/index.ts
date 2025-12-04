import {
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  InteractionReplyOptions,
  Message,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { pika } from "@drainpixie/pika";
import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";

type Dictionary = Record<string, string>;

const logger = pika({ scope: "marco" });
const database = new Keyv(new KeyvSqlite("sqlite://marco.sqlite"));

const commands = [
  new SlashCommandBuilder()
    .setName("correct")
    .setDescription("manage mention replacements")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("add a mention replacement")
        .addUserOption((option) =>
          option
            .setName("target")
            .setDescription("user whose mentions should be replaced")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("replacement")
            .setDescription("text to replace mentions with")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("rm")
        .setDescription("remove a mention replacement")
        .addUserOption((option) =>
          option
            .setName("target")
            .setDescription("user to stop replacing")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("ls").setDescription("list all configured replacements"),
    ),
].map((cmd) => cmd.toJSON());

function env(key: string, or?: string): string {
  const prop = process.env[key] ?? or;
  if (!prop) {
    logger.error(`environment variable '${key}' missing but required.`);
    process.exit(1);
  }
  return prop;
}

async function handleMessage(message: Message) {
  if (message.author.bot || !message.guildId) return;
  if (!message.channel.isSendable()) return;

  const replacements = await database.get<Dictionary>(message.guildId);
  if (!replacements) return;

  const id = Object.keys(replacements) //
    .find((x) => message.mentions.users.has(x));

  if (!id) return;

  try {
    await message.delete();
    await message.channel.send({
      content: `**${message.author.username}:** ${message.content.replace(new RegExp(`<@!?${id}>`, "g"), replacements[id])}`,
      files: message.attachments.map((x) => x.url),
    });

    logger.debug(`replaced mention in message from ${message.author.username}`);
  } catch (error) {
    logger.error("couldn't process message", error);
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction<"cached">) {
  const target = interaction.options.getUser("target", true);
  const replacement = interaction.options.getString("replacement", true);

  const replacements = await database.get<Dictionary>(interaction.guildId);
  await database.set(interaction.guildId, {
    ...replacements,
    [target.id]: replacement,
  });

  await interaction.reply({
    content: `✅ Mentions for ${target} will now be replaced with '${replacement}'`,
    flags: MessageFlags.Ephemeral,
  });

  logger.info(`set replacement for ${target.username} as '${replacement}'`);
}

async function handleRm(interaction: ChatInputCommandInteraction<"cached">) {
  const target = interaction.options.getUser("target", true);
  const replacements = await database.get<Dictionary>(interaction.guildId);

  if (!replacements || !(target.id in replacements)) {
    await interaction.reply({
      content: `❌ No replacement configured for ${target}`,
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // NOTE: this is better than the alternative, trust.
  const { [target.id]: _, ...rest } = replacements;
  void _;

  await database.set(interaction.guildId, rest);

  await interaction.reply({
    content: `✅ Removed replacement for ${target}`,
    flags: MessageFlags.Ephemeral,
  });

  logger.info(`removed replacement for ${target.username}`);
}

async function handleLs(interaction: ChatInputCommandInteraction<"cached">) {
  const replacements = await database.get<Dictionary>(interaction.guildId);

  if (!replacements || Object.keys(replacements).length === 0) {
    await interaction.reply({
      content: "No replacements configured.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const list = Object.entries(replacements)
    .map(([target, replacement]) => `- <@${target}> → "${replacement}"`)
    .join("\n");

  await interaction.reply({
    content: `**Configured Replacements:**\n${list}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleInteraction(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || !interaction.guildId) return;
  if (interaction.commandName !== "correct") return;

  await interaction.guild?.fetch();
  if (!interaction.inCachedGuild()) return;

  try {
    const sub = interaction.options.getSubcommand();

    if (sub === "add") await handleAdd(interaction);
    else if (sub === "rm") await handleRm(interaction);
    else if (sub === "ls") await handleLs(interaction);
  } catch (error) {
    logger.error("command error", error);

    const reply: InteractionReplyOptions = {
      content: "❌ An error occurred while processing the command.",
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred)
      await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
}

async function register(clientId: string) {
  const { info, error } = logger.scope("rest");

  try {
    info("registering slash commands");
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    info("slash commands registered");
  } catch (e) {
    error("failed to register commands", e);
  }
}

const TOKEN = env("MARCO_TOKEN");

logger.warn("ensure privileged intents to read message content");

const rest = new REST().setToken(TOKEN);
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client
  .on(Events.ClientReady, async (ready) => {
    logger.info("marco is ready");
    await register(ready.user.id);
  })
  .on(Events.InteractionCreate, handleInteraction)
  .on(Events.MessageCreate, handleMessage)
  .login(TOKEN);

database.on("error", (e) =>
  logger.scope("database").error("couldn't connect", e),
);
