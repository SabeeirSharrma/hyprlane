import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const commands = [];
const commandsDir = path.join(import.meta.dirname, '..', 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const cmd = await import(path.join(commandsDir, file));
  commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.token);

try {
  console.log(`[DEPLOY] Registering ${commands.length} commands...`);

  await rest.put(
    Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
    { body: commands }
  );

  console.log(`[DEPLOY] Done — ${commands.length} commands registered.`);
} catch (err) {
  console.error('[DEPLOY] Failed:', err);
}
