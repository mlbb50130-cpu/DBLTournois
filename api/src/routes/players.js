const Players = require('../services/players');
const Matches = require('../services/matches');

module.exports = async function (fastify) {
  fastify.post('/players/link', async (req) => {
    const { platform, externalId, code } = req.body || {};
    return Players.link(platform, externalId, String(code || '').toUpperCase());
  });

  fastify.get('/players/match', async (req) => {
    const { platform, externalId } = req.query || {};
    return Matches.getMyMatchMessage(platform, externalId);
  });
};
