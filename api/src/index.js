const Fastify = require('fastify');
const config = require('./config');
const { connectDatabase } = require('./db');
const { AppError } = require('./utils/errors');

async function start() {
  await connectDatabase();

  // Logs propres : niveau configurable, pas de log par requête (juste les erreurs).
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'warn' },
    disableRequestLogging: true,
  });

  // Gestion d'erreurs : renvoie toujours un champ `message` exploitable par les bots.
  app.setErrorHandler((error, req, reply) => {
    const status = error instanceof AppError ? error.statusCode : error.statusCode || 500;
    if (status >= 500) {
      req.log.error(error);
      reply.code(500).send({ message: 'Erreur interne du serveur.' });
      return;
    }
    reply.code(status).send({ message: error.message });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(require('./routes/registrations'));
  app.register(require('./routes/players'));
  app.register(require('./routes/tournaments'));
  app.register(require('./routes/matches'));
  app.register(require('./routes/settings'));
  app.register(require('./routes/admin'));

  await app.listen({ port: config.PORT, host: config.HOST });
  console.log(`✅ API DBL démarrée sur ${config.HOST}:${config.PORT}`);
}

start().catch((error) => {
  console.error('Erreur fatale au démarrage de l’API :', error);
  process.exit(1);
});
