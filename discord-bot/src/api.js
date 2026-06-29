const config = require('./config');

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(pathname, { method = 'GET', body, admin = false } = {}) {
  const url = `${config.API_BASE_URL}${pathname}`;
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (config.API_KEY) headers.Authorization = `Bearer ${config.API_KEY}`;
  if (admin && config.ADMIN_KEY) headers['x-admin-key'] = config.ADMIN_KEY;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("L'API centrale est injoignable. Réessaie plus tard.", 0);
  }

  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }
  }
  if (!res.ok) {
    throw new ApiError(data?.message || `Erreur API (${res.status}).`, res.status, data);
  }
  return data || {};
}

const PLATFORM = 'discord';

module.exports = {
  ApiError,

  joinTournament: (externalId, pseudo) =>
    request('/registrations', { method: 'POST', body: { platform: PLATFORM, externalId, pseudo } }),

  withdraw: (externalId) =>
    request('/registrations/withdraw', { method: 'POST', body: { platform: PLATFORM, externalId } }),

  linkAccount: (externalId, code) =>
    request('/players/link', { method: 'POST', body: { platform: PLATFORM, externalId, code } }),

  getBracket: () => request('/tournaments/active/bracket'),

  getMyMatch: (externalId) =>
    request(`/players/match?platform=${PLATFORM}&externalId=${encodeURIComponent(externalId)}`),

  reportScore: (externalId, score) =>
    request('/matches/score', { method: 'POST', body: { platform: PLATFORM, externalId, score } }),

  validateScore: (externalId) =>
    request('/matches/validate', { method: 'POST', body: { platform: PLATFORM, externalId } }),

  contestScore: (externalId) =>
    request('/matches/contest', { method: 'POST', body: { platform: PLATFORM, externalId } }),

  getStandings: () => request('/tournaments/active/standings'),
  getParticipants: () => request('/tournaments/active/participants'),
  getInfo: () => request('/tournaments/active/info'),

  getDisplaySettings: () => request('/settings/display'),
  updateDisplaySettings: (patch) => request('/settings/display', { method: 'POST', body: patch }),

  // --- Admin ---
  createTournament: (data) => request('/admin/tournaments', { method: 'POST', body: data, admin: true }),
  startActiveTournament: () => request('/admin/active/start', { method: 'POST', admin: true }),
  closeActiveTournament: () => request('/admin/active/close', { method: 'POST', admin: true }),
  disqualify: (payload) => request('/admin/disqualify', { method: 'POST', body: payload, admin: true }),
  listLitiges: () => request('/admin/active/litiges', { admin: true }),
  resolveByCode: (code, score) =>
    request(`/admin/matches/code/${encodeURIComponent(code)}/resolve`, {
      method: 'POST',
      body: { score },
      admin: true,
    }),
};
