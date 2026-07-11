import { api } from '../api.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  if (member.user.bot) return;

  const { guild, user } = member;

  try {
    const status = await api.getMemberStatus(guild.id, user.id);

    if (status.verified) {
      const config = await api.getGuildConfig(guild.id);
      const roleId = config.verified_role_id;

      if (roleId) {
        await member.roles.add(roleId);
        console.log(`[JOIN] ${user.tag} auto-verified in ${guild.name}`);
      }
      return;
    }

    const link = await api.createVerificationLink(guild.id, user.id);

    try {
      await user.send(
        `Welcome to **${guild.name}**!\n\n` +
        `You're not yet verified with Hyprlane. Verify once, get instant access everywhere.\n\n` +
        `<${link.url}>`
      );
      console.log(`[JOIN] ${user.tag} DM'd verification link in ${guild.name}`);
    } catch {
      console.log(`[JOIN] ${user.tag} has DMs closed in ${guild.name}`);
    }
  } catch (err) {
    console.error(`[JOIN] Error handling ${user.tag} in ${guild.name}:`, err.message);
  }
}
