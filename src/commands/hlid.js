import { SlashCommandBuilder } from 'discord.js';
import { api } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('hlid')
  .setDescription('Show your Hyprlane ID card');

export async function execute(interaction) {
  await interaction.deferReply();

  const card = await api.getUserHlidCard(interaction.user.id);

  if (card.image_url) {
    return interaction.editReply({
      embeds: [{
        image: { url: card.image_url },
        color: 0xf59e0b,
      }],
    });
  }

  return interaction.editReply({
    embeds: [{
      title: 'Hyprlane ID',
      fields: [
        { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Verified', value: card.verified_at ? `Yes — <t:${Math.floor(new Date(card.verified_at).getTime() / 1000)}:R>` : 'No', inline: true },
        { name: 'Servers', value: String(card.verified_guild_count ?? 0), inline: true },
      ],
      color: 0xf59e0b,
    }],
  });
}
