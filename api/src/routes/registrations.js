const Registrations = require('../services/registrations');

module.exports = async function (fastify) {
  fastify.post('/registrations', async (req) => {
    const { platform, externalId, pseudo } = req.body || {};
    return Registrations.register(platform, externalId, pseudo);
  });

  fastify.post('/registrations/withdraw', async (req) => {
    const { platform, externalId } = req.body || {};
    return Registrations.withdraw(platform, externalId);
  });
};
