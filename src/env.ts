import { pika } from "@drainpixie/pika";
import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";

const logger = pika({ scope: "marco" });

type Replacements = Record<string, string>;
class ReplacementService {
  #db: Keyv;

  constructor(url: string) {
    this.#db = new Keyv(new KeyvSqlite(url));
    this.#db.on("error", logger.scope("database").error);
  }

  async get(guild: string) {
    return (await this.#db.get<Replacements>(guild)) ?? {};
  }

  async add(guild: string, user: string, replacement: string) {
    const current = await this.get(guild);
    await this.#db.set(guild, { ...current, [user]: replacement });
  }

  async remove(guild: string, user: string) {
    const current = await this.get(guild);
    if (!(user in current)) return false;

    const { [user]: _, ...rest } = current;
    void _;

    await this.#db.set(guild, rest);
    return true;
  }
}

function getEnv(key: string, fallback?: string) {
  const value = process.env[key] ?? fallback;
  if (!value) {
    logger.error(`missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

const config = {
  token: getEnv("MARCO_TOKEN"),
  port: Number(getEnv("MARCO_PORT", "3000")),
  databaseURL: getEnv("DATABASE_URL", "sqlite://marco.sqlite"),
};

const replacements = new ReplacementService(config.databaseURL);

export { replacements, logger, config };
