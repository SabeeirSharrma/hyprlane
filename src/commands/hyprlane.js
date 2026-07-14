import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { api } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('hyprlane')
  .setDescription('Hyprlane verification bot commands')
  .addSubcommand(sub =>
    sub
      .setName('setup')
      .setDescription('Configure Hyprlane for this server')
      .addRoleOption(opt =>
        opt.setName('verified_role').setDescription('Role to assign on verification').setRequired(true)
      )
      .addChannelOption(opt =>
        opt.setName('log_channel').setDescription('Channel for audit logs')
      )
      .addRoleOption(opt =>
        opt.setName('mod_role').setDescription('Role allowed to use mod commands')
      )
      .addChannelOption(opt =>
        opt.setName('verification_channel').setDescription('Channel visible to unverified users with verification instructions')
      )
  )
  .addSubcommand(sub =>
    sub.setName('status').setDescription('Show current config and verification stats')
  )
  .addSubcommand(sub =>
    sub
      .setName('check')
      .setDescription('Check a user\'s verification status')
      .addUserOption(opt =>
        opt.setName('user').setDescription('User to check').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('revoke')
      .setDescription('Strip verified role from a user (local only)')
      .addUserOption(opt =>
        opt.setName('user').setDescription('User to revoke').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('sync')
      .setDescription('Auto-verify all existing members who are already verified with Hyprlane')
  )
  .addSubcommand(sub =>
    sub
      .setName('feature')
      .setDescription('Manage verification features')
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('enable, disable, or config')
          .setRequired(true)
          .addChoices(
            { name: 'enable', value: 'enable' },
            { name: 'disable', value: 'disable' },
            { name: 'config', value: 'config' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('feature_id')
          .setDescription('Feature to manage')
          .setRequired(true)
          .addChoices(
            { name: 'require_challenge', value: 'require_challenge' },
            { name: 'mod_review', value: 'mod_review' },
            { name: 'booster_bypass', value: 'booster_bypass' },
            { name: 'raid_protection', value: 'raid_protection' },
            { name: 'audit_export', value: 'audit_export' },
            { name: 'custom_success_page', value: 'custom_success_page' },
            { name: 'custom_timeout', value: 'custom_timeout' },
            { name: 'vanity_url', value: 'vanity_url' },
            { name: 'config_duplicate', value: 'config_duplicate' },
            { name: 'custom_verification_domain', value: 'custom_verification_domain' }
          )
      )
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Channel (for mod_review config)')
      )
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === 'setup') {
    const verifiedRole = interaction.options.getRole('verified_role');
    const logChannel = interaction.options.getChannel('log_channel');
    const modRole = interaction.options.getRole('mod_role');
    const verificationChannel = interaction.options.getChannel('verification_channel');

    const configUpdate = {
      verified_role_id: verifiedRole.id,
    };
    if (logChannel) configUpdate.log_channel_id = logChannel.id;
    if (modRole) configUpdate.mod_role_id = modRole.id;
    if (verificationChannel) configUpdate.verification_channel_id = verificationChannel.id;

    await api.updateGuildConfig(guildId, configUpdate);

    // If verification channel is set, set up permissions and post instructions
    if (verificationChannel) {
      await setupVerificationChannel(interaction.guild, verificationChannel.id, verifiedRole.id);
    }

    return interaction.reply({
      content: `Hyprlane configured.\nVerified role: <@&${verifiedRole.id}>` +
        (logChannel ? `\nLog channel: <#${logChannel.id}>` : '') +
        (modRole ? `\nMod role: <@&${modRole.id}>` : '') +
        (verificationChannel ? `\nVerification channel: <#${verificationChannel.id}>` : ''),
      ephemeral: true,
    });
  }

  if (sub === 'status') {
    const config = await api.getGuildConfig(guildId);
    const stats = await api.getGuildStats(guildId);

    return interaction.reply({
      embeds: [{
        title: 'Hyprlane Status',
        fields: [
          { name: 'Verified Role', value: config.verified_role_id ? `<@&${config.verified_role_id}>` : 'Not set', inline: true },
          { name: 'Log Channel', value: config.log_channel_id ? `<#${config.log_channel_id}>` : 'None', inline: true },
          { name: 'Verification Channel', value: config.verification_channel_id ? `<#${config.verification_channel_id}>` : 'None', inline: true },
          { name: 'Enrolled Features', value: (config.enrolled_features || []).join(', ') || 'None', inline: true },
          { name: 'Total Verified', value: String(stats.verified_count ?? 0), inline: true },
        ],
        color: 0xf59e0b,
      }],
      ephemeral: true,
    });
  }

  if (sub === 'check') {
    const target = interaction.options.getUser('user');
    const status = await api.getMemberStatus(guildId, target.id);

    return interaction.reply({
      embeds: [{
        title: `Verification Status — ${target.tag}`,
        fields: [
          { name: 'Global Status', value: status.status || 'unknown', inline: true },
          { name: 'Verified', value: status.verified ? 'Yes' : 'No', inline: true },
          { name: 'Verified At', value: status.verified_at ? `<t:${Math.floor(new Date(status.verified_at).getTime() / 1000)}:R>` : 'N/A', inline: true },
        ],
        color: status.verified ? 0x22c55e : 0xef4444,
      }],
      ephemeral: true,
    });
  }

  if (sub === 'revoke') {
    const target = interaction.options.getUser('user');
    await api.revokeMember(guildId, target.id);

    // Remove role if they have it
    try {
      const member = await interaction.guild.members.fetch(target.id);
      const config = await api.getGuildConfig(guildId);
      if (config.verified_role_id) {
        await member.roles.remove(config.verified_role_id);
      }
    } catch {}

    return interaction.reply({
      content: `Revoked verified role for **${target.tag}** in this server (global record untouched).`,
      ephemeral: true,
    });
  }

  if (sub === 'sync') {
    await interaction.deferReply({ ephemeral: true });

    const config = await api.getGuildConfig(guildId);
    const roleId = config.verified_role_id;
    if (!roleId) {
      return interaction.editReply('No verified role configured. Run `/hyprlane setup` first.');
    }

    let checked = 0;
    let assigned = 0;
    let alreadyHad = 0;

    // Fetch all members (paginated)
    let lastMemberId = undefined;
    let done = false;

    while (!done) {
      const options = { limit: 1000 };
      if (lastMemberId) options.after = lastMemberId;

      const members = await interaction.guild.members.fetch(options);
      if (members.size === 0) break;

      for (const [id, member] of members) {
        if (member.user.bot) continue;
        checked++;

        try {
          const status = await api.getMemberStatus(guildId, id);
          if (status.verified) {
            if (!member.roles.cache.has(roleId)) {
              await member.roles.add(roleId);
              assigned++;
            } else {
              alreadyHad++;
            }
          }
        } catch (err) {
          // Skip on error
        }
      }

      lastMemberId = members.lastKey();
      if (members.size < 1000) done = true;
    }

    return interaction.editReply(
      `Sync complete.\n` +
      `Checked: ${checked} members\n` +
      `Newly assigned: ${assigned}\n` +
      `Already had role: ${alreadyHad}`
    );
  }

  if (sub === 'feature') {
    const action = interaction.options.getString('action');
    const featureId = interaction.options.getString('feature_id');
    const config = await api.getGuildConfig(guildId);

    if (action === 'config') {
      if (featureId !== 'mod_review') {
        return interaction.reply({ content: 'Config is only available for `mod_review`.', ephemeral: true });
      }

      const channel = interaction.options.getChannel('channel');
      if (!channel) {
        return interaction.reply({ content: 'Please provide a channel for mod review.', ephemeral: true });
      }

      const featureConfig = config.feature_config || {};
      featureConfig.mod_review = { channel_id: channel.id };

      await api.updateGuildConfig(guildId, { feature_config: featureConfig });

      return interaction.reply({
        content: `Mod review channel set to <#${channel.id}>.`,
        ephemeral: true,
      });
    }

    // enable / disable
    const features = new Set(config.enrolled_features || []);

    if (action === 'enable') features.add(featureId);
    else features.delete(featureId);

    await api.updateGuildConfig(guildId, { enrolled_features: [...features] });

    return interaction.reply({
      content: `Feature \`${featureId}\` ${action === 'enable' ? 'enabled' : 'disabled'} for this server.`,
      ephemeral: true,
    });
  }
}

async function setupVerificationChannel(guild, channelId, verifiedRoleId) {
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel) return;

    // Set permissions: @everyone can view but not send, verified role can view
    await channel.permissionOverwrites.edit(guild.id, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true,
    });

    // Hide verification channel from verified users (they don't need to see it)
    await channel.permissionOverwrites.edit(verifiedRoleId, {
      ViewChannel: false,
    });

    // Post verification instructions
    if (channel.isTextBased()) {
      await channel.send({
        embeds: [{
          title: 'Welcome to Hyprlane Verification',
          description: 'To gain access to this server, you need to verify your identity with Hyprlane.\n\n' +
            '**How to verify:**\n' +
            '1. The bot will DM you a verification link\n' +
            '2. Click the link and log in with Discord\n' +
            '3. Complete the Turnstile challenge\n' +
            '4. Your role will be assigned automatically\n\n' +
            '**Already verified?** You already have access — welcome!\n\n' +
            'If you have DMs closed, ask a moderator for help.',
          color: 0xE8A93F,
          footer: { text: 'Hyprlane — Cross-server verification' },
        }],
      });
    }
  } catch (err) {
    console.error('[SETUP] Failed to configure verification channel:', err.message);
  }
}
