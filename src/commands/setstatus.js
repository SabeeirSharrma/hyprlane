import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { api } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('setstatus')
  .setDescription('Check or set a user\'s local verification status')
  .addUserOption(opt =>
    opt.setName('user').setDescription('Target user').setRequired(true)
  )
  .addStringOption(opt =>
    opt
      .setName('status')
      .setDescription('New status (omit to just check)')
      .addChoices(
        { name: 'verified', value: 'verified' },
        { name: 'unverified', value: 'unverified' },
        { name: 'pending_mod_review', value: 'pending_mod_review' }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const target = interaction.options.getUser('user');
  const status = interaction.options.getString('status');
  const guildId = interaction.guildId;

  if (!status) {
    const result = await api.getMemberStatus(guildId, target.id);

    return interaction.reply({
      embeds: [{
        title: `Status — ${target.tag}`,
        fields: [
          { name: 'Global', value: result.status || 'unknown', inline: true },
          { name: 'Local Override', value: result.local_status || 'None (auto)', inline: true },
        ],
        color: 0xf59e0b,
      }],
      ephemeral: true,
    });
  }

  await api.setMemberStatus(guildId, target.id, status);

  return interaction.reply({
    content: `Set **${target.tag}** to \`${status}\` in this server.`,
    ephemeral: true,
  });
}
