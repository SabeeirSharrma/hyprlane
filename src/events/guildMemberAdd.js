import { api } from '../api.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  if (member.user.bot) return;

  const { guild, user } = member;

  try {
    const status = await api.getMemberStatus(guild.id, user.id);
    const config = await api.getGuildConfig(guild.id);
    const features = config.enrolled_features || [];

    if (status.verified) {
      // Check feature gates before assigning role
      if (features.includes('phone_required') && !status.phone_linked) {
        console.log(`[JOIN] ${user.tag} verified but missing phone in ${guild.name}`);
        // TODO: Send DM asking to link phone
        return;
      }

      const roleId = config.verified_role_id;
      if (roleId) {
        await member.roles.add(roleId);
        console.log(`[JOIN] ${user.tag} auto-verified in ${guild.name}`);
      }
      return;
    }

    // Not verified — create verification link
    const link = await api.createVerificationLink(guild.id, user.id);

    // Try DM first
    let dmSent = false;
    try {
      await user.send(
        `Welcome to **${guild.name}**!\n\n` +
        `You're not yet verified with Hyprlane. Verify once, get instant access everywhere.\n\n` +
        `<${link.url}>`
      );
      dmSent = true;
      console.log(`[JOIN] ${user.tag} DM'd verification link in ${guild.name}`);
    } catch {
      console.log(`[JOIN] ${user.tag} has DMs closed in ${guild.name}`);
    }

    // DM fallback: send to log channel if configured
    if (!dmSent && config.log_channel_id) {
      try {
        const logChannel = await guild.channels.fetch(config.log_channel_id);
        if (logChannel?.isTextBased()) {
          await logChannel.send(
            `<@${user.id}> has joined but is not verified. ` +
            `Please verify at <${link.url}>`
          );
          console.log(`[JOIN] Sent fallback message in ${guild.name} log channel`);
        }
      } catch {
        console.log(`[JOIN] Could not send fallback message in ${guild.name}`);
      }
    }
  } catch (err) {
    console.error(`[JOIN] Error handling ${user.tag} in ${guild.name}:`, err.message);
  }
}
