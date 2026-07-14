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
            { name: 'phone_required', value: 'phone_required' },
            { name: 'mod_review', value: 'mod_review' }
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

    await api.updateGuildConfig(guildId, {
      verified_role_id: verifiedRole.id,
      ...(logChannel ? { log_channel_id: logChannel.id } : {}),
      ...(modRole ? { mod_role_id: modRole.id } : {}),
    });

    return interaction.reply({
      content: `Hyprlane configured.\nVerified role: <@&${verifiedRole.id}>` +
        (logChannel ? `\nLog channel: <#${logChannel.id}>` : '') +
        (modRole ? `\nMod role: <@&${modRole.id}>` : ''),
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

    return interaction.reply({
      content: `Revoked verified role for **${target.tag}** in this server (global record untouched).`,
      ephemeral: true,
    });
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
