const { REST, Routes } = require('discord.js');
const config = require('./config');
const { commands } = require('./commands');

if (!config.TOKEN || !config.CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN et DISCORD_CLIENT_ID requis dans .env.');
  process.exit(1);
}

(async () => {
  const body = commands.map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.TOKEN);

  try {
    if (config.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body });
      console.log(`✅ ${body.length} commandes enregistrées sur le serveur ${config.GUILD_ID} (instantané).`);
    } else {
      await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body });
      console.log(`✅ ${body.length} commandes enregistrées globalement (propagation ~1h).`);
    }
  } catch (error) {
    console.error('Échec de l\'enregistrement des commandes :', error);
    process.exit(1);
  }
})();
