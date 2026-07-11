import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    secret: process.env.API_SERVICE_SECRET,
  },
};
