import { config } from './config.js';

const BASE = config.api.baseUrl;
const SECRET = config.api.secret;

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json();
}

export const api = {
  getMemberStatus: (guildId, userId) =>
    request('GET', `/guilds/${guildId}/members/${userId}/status`),

  createVerificationLink: (guildId, userId) =>
    request('POST', `/guilds/${guildId}/verification-links`, { discord_id: userId }),

  getGuildConfig: (guildId) =>
    request('GET', `/guilds/${guildId}/config`),

  updateGuildConfig: (guildId, data) =>
    request('PUT', `/guilds/${guildId}/config`, data),

  getUserHlidCard: (userId) =>
    request('GET', `/users/${userId}/hlid-card`),

  setMemberStatus: (guildId, userId, status) =>
    request('POST', `/guilds/${guildId}/members/${userId}/setstatus`, { status }),

  revokeMember: (guildId, userId) =>
    request('POST', `/guilds/${guildId}/members/${userId}/revoke`),

  getVerifiedMembers: (guildId) =>
    request('GET', `/guilds/${guildId}/verified-members`),

  getGuildStats: (guildId) =>
    request('GET', `/guilds/${guildId}/stats`),
};
