import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('hlid')
  .setDescription('Show your Hyprlane ID card');

export async function execute(interaction) {
  await interaction.deferReply();

  const baseUrl = config.api.baseUrl;
  const cardUrl = `${baseUrl}/users/${interaction.user.id}/hlid-card`;

  try {
    const res = await fetch(cardUrl, {
      headers: { Authorization: `Bearer ${config.api.secret}` },
    });

    if (!res.ok) {
      return interaction.editReply({ content: 'Failed to generate ID card.' });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const attachment = {
      attachment: buffer,
      name: 'hlid-card.png',
    };

    return interaction.editReply({
      files: [attachment],
    });
  } catch (err) {
    return interaction.editReply({ content: 'Failed to generate ID card.' });
  }
}
