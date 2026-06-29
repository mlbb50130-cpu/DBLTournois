const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('./config');
const api = require('./api');
const { isAdmin } = require('./utils/admin');
const { commands, standingsPayload, bracketPayload } = require('./commands');

if (!config.TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant. Voir le README / les variables.');
  if (require.main === module) process.exit(1);
}

const byName = new Map(commands.map((c) => [c.data.name, c]));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`✅ ${config.BOT_NAME} connecté en tant que ${c.user.tag}`);
});

// --- Boutons (Valider / Contester / Actualiser) ---
async function handleButton(interaction) {
  const id = interaction.customId;
  try {
    if (id === 'valider' || id === 'contester') {
      await interaction.deferReply({ ephemeral: true });
      const r = id === 'valider'
        ? await api.validateScore(interaction.user.id)
        : await api.contestScore(interaction.user.id);
      await interaction.editReply(r.message || '✅ OK.');
    } else if (id === 'refresh-classement') {
      await interaction.deferUpdate();
      await interaction.editReply(await standingsPayload(api));
    } else if (id === 'refresh-bracket') {
      await interaction.deferUpdate();
      await interaction.editReply(await bracketPayload(api));
    }
  } catch (error) {
    const msg = error && error.name === 'ApiError' ? `⚠️ ${error.message}` : '❌ Une erreur est survenue.';
    if (error && error.name !== 'ApiError') console.error(`Erreur bouton ${id}:`, error);
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg, ephemeral: true });
      else await interaction.reply({ content: msg, ephemeral: true });
    } catch {
      /* interaction expirée */
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  const command = byName.get(interaction.commandName);
  if (!command) return;

  if (command.adminOnly && !isAdmin(interaction)) {
    await interaction.reply({ content: '⛔ Commande réservée aux administrateurs.', ephemeral: true });
    return;
  }

  const ctx = {
    api,
    config,
    externalId: interaction.user.id,
    pseudo: interaction.user.username,
    isAdmin: () => isAdmin(interaction),
  };

  try {
    await interaction.deferReply();
    await command.execute(interaction, ctx);
  } catch (error) {
    const msg = error && error.name === 'ApiError' ? `⚠️ ${error.message}` : '❌ Une erreur est survenue.';
    if (error && error.name !== 'ApiError') console.error(`Erreur /${interaction.commandName}:`, error);
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await interaction.reply(msg);
    } catch {
      /* interaction expirée */
    }
  }
});

if (config.TOKEN) {
  client.login(config.TOKEN).catch((e) => {
    console.error('Échec de connexion Discord :', e && e.message ? e.message : e);
  });
}
