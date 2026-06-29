const config = require('../config');
const Tournaments = require('../services/tournaments');
const Matches = require('../services/matches');

module.exports = async function (fastify) {
  // Protection par clé admin (si ADMIN_KEY est défini).
  fastify.addHook('preHandler', async (req, reply) => {
    if (config.ADMIN_KEY && req.headers['x-admin-key'] !== config.ADMIN_KEY) {
      reply.code(401).send({ message: 'Clé admin invalide.' });
    }
  });

  fastify.get('/admin/tournaments', async () => Tournaments.list());

  fastify.post('/admin/tournaments', async (req) => Tournaments.create(req.body || {}));

  fastify.post('/admin/tournaments/:id/start', async (req) => Tournaments.start(req.params.id));

  fastify.post('/admin/tournaments/:id/close', async (req) => Tournaments.close(req.params.id));

  // Agissent sur le tournoi actif (pas d'id à fournir) — pratique pour les bots.
  fastify.post('/admin/active/start', async () => Tournaments.startActive());

  fastify.post('/admin/active/close', async () => Tournaments.closeActive());

  fastify.post('/admin/matches/:id/resolve', async (req) => {
    const { score } = req.body || {};
    return Matches.adminResolve(req.params.id, score);
  });

  fastify.get('/admin/active/litiges', async () => Matches.listLitiges());

  fastify.post('/admin/disqualify', async (req) => Matches.disqualify(req.body || {}));

  fastify.post('/admin/matches/code/:code/resolve', async (req) => {
    const { score } = req.body || {};
    return Matches.adminResolveByCode(req.params.code, score);
  });
};
