import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { api } from './api.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

// Dynamic event loading
const eventsDir = path.join(import.meta.dirname, 'events');
const eventFiles = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = await import(path.join(eventsDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.once('ready', () => {
  console.log(`[HYPRLANE] Online as ${client.user.tag} — serving ${client.guilds.cache.size} guilds`);
  startRoleAssignmentPoller();
});

// Poll for users who completed verification and need roles assigned
function startRoleAssignmentPoller() {
  const POLL_INTERVAL = 30_000; // 30 seconds

  setInterval(async () => {
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const config = await api.getGuildConfig(guildId);
        const roleId = config.verified_role_id;
        if (!roleId) continue;

        const { needs_role } = await api.pollRoleAssignments(guildId);
        if (needs_role.length === 0) continue;

        const confirmed = [];
        for (const discordId of needs_role) {
          try {
            const member = await guild.members.fetch(discordId);
            if (!member) continue;

            await member.roles.add(roleId);
            confirmed.push(discordId);
            console.log(`[POLL] Assigned role to ${member.user.tag} in ${guild.name}`);
          } catch (err) {
            console.error(`[POLL] Failed to assign role to ${discordId} in ${guild.name}:`, err.message);
          }
        }

        if (confirmed.length > 0) {
          await api.confirmRoleAssignments(guildId, confirmed);
        }
      } catch (err) {
        console.error(`[POLL] Error polling guild ${guildId}:`, err.message);
      }
    }
  }, POLL_INTERVAL);
}

client.login(config.token);
