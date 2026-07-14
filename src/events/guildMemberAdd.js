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
    const modReviewChannelId = config.feature_config?.mod_review?.channel_id;

    if (status.verified) {
      // require_challenge: re-run verification even for already-verified users
      if (features.includes('require_challenge')) {
        const link = await api.createVerificationLink(guild.id, user.id);
        try {
          await user.send(
            `Welcome back to **${guild.name}**!\n\n` +
            `This server requires re-verification. Please complete the challenge again:\n\n` +
            `<${link.url}>`
          );
        } catch {
          // DMs closed — try log channel fallback
          if (config.log_channel_id) {
            try {
              const ch = await guild.channels.fetch(config.log_channel_id);
              if (ch?.isTextBased()) {
                await ch.send(`<@${user.id}> rejoined but needs re-verification: <${link.url}>`);
              }
            } catch {}
          }
        }
        return;
      }

      // mod_review: set pending status, don't assign role yet
      if (features.includes('mod_review') && status.local_status !== 'verified') {
        await api.setMemberStatus(guild.id, user.id, 'pending_mod_review');
        try {
          const channelHint = modReviewChannelId
            ? `Please run \`/hlid\` in <#${modReviewChannelId}> for a moderator to review.`
            : `Please run \`/hlid\` in a channel your moderators can see.`;
          await user.send(
            `Welcome to **${guild.name}**!\n\n` +
            `You're verified with Hyprlane, but this server requires moderator approval.\n\n` +
            `${channelHint}`
          );
        } catch {
          if (config.log_channel_id) {
            try {
              const ch = await guild.channels.fetch(config.log_channel_id);
              if (ch?.isTextBased()) {
                await ch.send(
                  `<@${user.id}> is verified but needs mod review. ` +
                  (modReviewChannelId ? `Review in <#${modReviewChannelId}>.` : '')
                );
              }
            } catch {}
          }
        }
        return;
      }

      // All gates passed — assign role
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
