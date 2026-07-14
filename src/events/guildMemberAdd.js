import { api } from '../api.js';

export const name = 'guildMemberAdd';
export const once = false;

// Raid protection: track joins per guild for rate monitoring
const joinTracker = new Map(); // guildId -> [{ timestamp }]

function cleanupJoinTracker() {
  const now = Date.now();
  for (const [guildId, joins] of joinTracker) {
    const recent = joins.filter(j => now - j.timestamp < 60000); // 1 min window
    if (recent.length === 0) joinTracker.delete(guildId);
    else joinTracker.set(guildId, recent);
  }
}
setInterval(cleanupJoinTracker, 30000);

export async function execute(member) {
  if (member.user.bot) return;

  const { guild, user } = member;

  try {
    const status = await api.getMemberStatus(guild.id, user.id);
    const config = await api.getGuildConfig(guild.id);
    const features = config.enrolled_features || [];
    const featureConfig = config.feature_config || {};
    const modReviewChannelId = featureConfig.mod_review?.channel_id;

    // Raid protection: track joins and check for spikes
    if (features.includes('raid_protection')) {
      const now = Date.now();
      if (!joinTracker.has(guild.id)) joinTracker.set(guild.id, []);
      const joins = joinTracker.get(guild.id);
      joins.push({ timestamp: now });

      const windowMs = (featureConfig.raid_protection?.window_seconds || 60) * 1000;
      const threshold = featureConfig.raid_protection?.threshold || 10;
      const recentJoins = joins.filter(j => now - j.timestamp < windowMs);

      if (recentJoins.length >= threshold) {
        // Raid detected — alert mods, skip auto-role
        console.log(`[RAID] Detected ${recentJoins.length} joins in ${guild.name} — locking down`);
        if (config.log_channel_id) {
          try {
            const ch = await guild.channels.fetch(config.log_channel_id);
            if (ch?.isTextBased()) {
              await ch.send(
                `⚠️ **Raid detected** — ${recentJoins.length} members joined in the last ${windowMs / 1000}s.\n` +
                `Auto-role assignment is paused. Moderators please review.`
              );
            }
          } catch {}
        }
        // Skip auto-role for this join — they'll need manual review
        return;
      }
    }

    // booster_bypass: skip verification for server boosters
    if (features.includes('booster_bypass') && member.premiumSince) {
      const roleId = config.verified_role_id;
      if (roleId) {
        await member.roles.add(roleId);
        console.log(`[JOIN] ${user.tag} auto-verified (booster bypass) in ${guild.name}`);
      }
      return;
    }

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
