import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.join(import.meta.dirname, '.env') });

export const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    secret: process.env.API_SERVICE_SECRET,
  },
};
