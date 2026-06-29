const Settings = require('../services/settings');

module.exports = async function (fastify) {
  fastify.get('/settings/display', async () => ({ display: await Settings.getDisplay() }));
  fastify.post('/settings/display', async (req) => Settings.updateDisplay(req.body || {}));
};
