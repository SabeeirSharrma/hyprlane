import { Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const name = 'interactionCreate';
export const once = false;

const commands = new Collection();

// Load all command files at startup
const commandsDir = path.join(import.meta.dirname, '..', 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const cmd = await import(path.join(commandsDir, file));
  commands.set(cmd.data.name, cmd);
}

export async function execute(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[CMD] Error in /${interaction.commandName}:`, err);

    const reply = { content: 'Something went wrong.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
