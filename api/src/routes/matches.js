const Matches = require('../services/matches');

module.exports = async function (fastify) {
  fastify.post('/matches/score', async (req) => {
    const { platform, externalId, score } = req.body || {};
    return Matches.reportScore(platform, externalId, score);
  });

  fastify.post('/matches/validate', async (req) => {
    const { platform, externalId } = req.body || {};
    return Matches.validateScore(platform, externalId);
  });

  fastify.post('/matches/contest', async (req) => {
    const { platform, externalId } = req.body || {};
    return Matches.contestScore(platform, externalId);
  });
};
