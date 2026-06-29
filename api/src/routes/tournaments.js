const Tournaments = require('../services/tournaments');
const Registrations = require('../services/registrations');

module.exports = async function (fastify) {
  fastify.get('/tournaments/active/bracket', async () => Tournaments.bracketMessage());
  fastify.get('/tournaments/active/standings', async () => Tournaments.standingsMessage());
  fastify.get('/tournaments/active/participants', async () => Registrations.participantsMessage());
  fastify.get('/tournaments/active/info', async () => Registrations.infoMessage());
};
