const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { renderStandingsImages } = require('./utils/standingsImage');
const { renderBracketImages } = require('./utils/bracketImage');

// --- Helpers ---

function stripStandingsPlatform(standings) {
  if (Array.isArray(standings)) {
    standings.forEach((s) => { s.platform = null; });
  } else if (standings && Array.isArray(standings.pools)) {
    standings.pools.forEach((p) => p.rows.forEach((r) => { r.platform = null; }));
    (standings.finale || []).forEach((s) => { s.platform = null; });
  }
}

function stripBracketPlatform(data) {
  if (!data) return;
  if (data.champion) data.champion.platform = null;
  const clear = (m) => { if (m.p1) m.p1.platform = null; if (m.p2) m.p2.platform = null; };
  for (const b of data.brackets || []) for (const round of b.rounds || []) round.forEach(clear);
  for (const pool of data.pools || []) (pool.matches || []).forEach(clear);
}

// Discord limite à 10 fichiers par message.
function filesFrom(images) {
  return images.slice(0, 10).map((im, i) => new AttachmentBuilder(im.buffer, { name: `dbl-${i}.png` }));
}

// Boutons de validation d'un score (pour l'adversaire).
function validationButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('valider').setLabel('Valider').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('contester').setLabel('Contester').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
  );
}

function refreshRow(customId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customId).setLabel('Actualiser').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
  );
}

// Payload du classement (texte ou images) + bouton Actualiser. Réutilisé par la
// slash command ET par le bouton de rafraîchissement.
async function standingsPayload(api) {
  const res = await api.getStandings();
  const display = res.display || {};
  if (display.standingsMode === 'texte') {
    return { content: res.message || 'Classement indisponible.', files: [], components: [refreshRow('refresh-classement')] };
  }
  const hasData =
    (Array.isArray(res.standings) && res.standings.length) ||
    (res.standings && Array.isArray(res.standings.pools) && res.standings.pools.length);
  if (hasData) {
    if (display.showPlatform === false) stripStandingsPlatform(res.standings);
    const images = await renderStandingsImages(res);
    if (images.length) {
      const note = images.length > 10 ? '\n_(10 images max affichées)_' : '';
      return { content: (images[0].caption || '') + note, files: filesFrom(images), components: [refreshRow('refresh-classement')] };
    }
  }
  return { content: res.message || 'Classement indisponible.', files: [], components: [refreshRow('refresh-classement')] };
}

// Payload du bracket + bouton Actualiser.
async function bracketPayload(api) {
  const res = await api.getBracket();
  const display = res.display || {};
  if (display.bracketMode === 'texte') {
    return { content: res.message || 'Aucun tournoi actif.', files: [], components: [refreshRow('refresh-bracket')] };
  }
  if (res.bracketData) {
    if (display.showPlatform === false) stripBracketPlatform(res.bracketData);
    const images = await renderBracketImages(res.bracketData);
    if (images.length) {
      const note = images.length > 10 ? '\n_(10 images max affichées)_' : '';
      return { content: (images[0].caption || '') + note, files: filesFrom(images), components: [refreshRow('refresh-bracket')] };
    }
  }
  return { content: res.message || 'Aucun tournoi actif.', files: [], components: [refreshRow('refresh-bracket')] };
}

// --- Commandes ---

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('join')
      .setDescription("S'inscrire au tournoi en cours")
      .addStringOption((o) => o.setName('pseudo').setDescription('Ton pseudo (par défaut ton nom Discord)')),
    async execute(interaction, ctx) {
      const pseudo = interaction.options.getString('pseudo') || ctx.pseudo;
      const res = await ctx.api.joinTournament(ctx.externalId, pseudo);
      await interaction.editReply(res.message || '✅ Inscription enregistrée.');
    },
  },
  {
    data: new SlashCommandBuilder().setName('desister').setDescription('Se désinscrire (avant le démarrage)'),
    async execute(interaction, ctx) {
      const res = await ctx.api.withdraw(ctx.externalId);
      await interaction.editReply(res.message || '✅ Désinscription confirmée.');
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('lier')
      .setDescription('Lier ce compte Discord à ton compte WhatsApp')
      .addStringOption((o) => o.setName('code').setDescription('Code de liaison (ex. DBL-7F3K)').setRequired(true)),
    async execute(interaction, ctx) {
      const code = interaction.options.getString('code').toUpperCase();
      const res = await ctx.api.linkAccount(ctx.externalId, code);
      await interaction.editReply(res.message || '✅ Comptes liés.');
    },
  },
  {
    data: new SlashCommandBuilder().setName('tournoi').setDescription('Infos du tournoi en cours'),
    async execute(interaction, ctx) {
      const res = await ctx.api.getInfo();
      await interaction.editReply(res.message || 'Aucun tournoi pour le moment.');
    },
  },
  {
    data: new SlashCommandBuilder().setName('participants').setDescription('Liste des inscrits'),
    async execute(interaction, ctx) {
      const res = await ctx.api.getParticipants();
      await interaction.editReply(res.message || 'Aucun inscrit.');
    },
  },
  {
    data: new SlashCommandBuilder().setName('monmatch').setDescription('Voir ton prochain match'),
    async execute(interaction, ctx) {
      const res = await ctx.api.getMyMatch(ctx.externalId);
      await interaction.editReply(res.message || "Tu n'as pas de match en attente.");
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('score')
      .setDescription('Déclarer le score de ton match')
      .addStringOption((o) => o.setName('score').setDescription('Tes manches - celles de l\'adversaire, ex. 2-1').setRequired(true)),
    async execute(interaction, ctx) {
      const score = interaction.options.getString('score');
      if (!/^\d+-\d+$/.test(score)) {
        await interaction.editReply('Format invalide. Exemple : 2-1');
        return;
      }
      const res = await ctx.api.reportScore(ctx.externalId, score);
      const oppId = res.opponent && res.opponent.discordId;
      const ping = oppId ? `<@${oppId}> ` : '';
      await interaction.editReply({
        content: ping + (res.message || '✅ Score envoyé.'),
        components: [validationButtons()],
        allowedMentions: { users: oppId ? [oppId] : [] },
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName('valider').setDescription('Confirmer le score déclaré par l\'adversaire'),
    async execute(interaction, ctx) {
      const res = await ctx.api.validateScore(ctx.externalId);
      await interaction.editReply(res.message || '✅ Score validé.');
    },
  },
  {
    data: new SlashCommandBuilder().setName('contester').setDescription('Contester le score déclaré → litige'),
    async execute(interaction, ctx) {
      const res = await ctx.api.contestScore(ctx.externalId);
      await interaction.editReply(res.message || '⚠️ Score contesté.');
    },
  },
  {
    data: new SlashCommandBuilder().setName('classement').setDescription('Afficher le classement'),
    async execute(interaction, ctx) {
      await interaction.editReply(await standingsPayload(ctx.api));
    },
  },
  {
    data: new SlashCommandBuilder().setName('bracket').setDescription('Afficher le tableau / les rencontres'),
    async execute(interaction, ctx) {
      await interaction.editReply(await bracketPayload(ctx.api));
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('affichage')
      .setDescription("Configurer l'affichage (admin pour modifier)")
      .addStringOption((o) =>
        o.setName('cible').setDescription('Quoi configurer').addChoices(
          { name: 'classement', value: 'classement' },
          { name: 'bracket', value: 'bracket' },
          { name: 'plateforme', value: 'plateforme' },
        ))
      .addStringOption((o) =>
        o.setName('valeur').setDescription('image | texte  (ou on | off pour plateforme)').addChoices(
          { name: 'image', value: 'image' },
          { name: 'texte', value: 'texte' },
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' },
        )),
    async execute(interaction, ctx) {
      const cible = interaction.options.getString('cible');
      const valeur = interaction.options.getString('valeur');

      if (!cible || !valeur) {
        const { display } = await ctx.api.getDisplaySettings();
        await interaction.editReply(
          `⚙️ **Affichage actuel**\n• Classement : **${display.standingsMode}**\n• Bracket : **${display.bracketMode}**\n• Badges plateforme : **${display.showPlatform ? 'on' : 'off'}**`,
        );
        return;
      }
      if (!ctx.isAdmin()) {
        await interaction.editReply('⛔ Seuls les administrateurs peuvent changer l\'affichage.');
        return;
      }
      const patch = {};
      if (cible === 'classement' && ['image', 'texte'].includes(valeur)) patch.standingsMode = valeur;
      else if (cible === 'bracket' && ['image', 'texte'].includes(valeur)) patch.bracketMode = valeur;
      else if (cible === 'plateforme' && ['on', 'off'].includes(valeur)) patch.showPlatform = valeur === 'on';
      else {
        await interaction.editReply('Combinaison invalide. classement/bracket → image|texte ; plateforme → on|off.');
        return;
      }
      const res = await ctx.api.updateDisplaySettings(patch);
      await interaction.editReply(res.message || '✅ Réglages mis à jour.');
    },
  },
  {
    data: new SlashCommandBuilder().setName('aide').setDescription('Liste des commandes'),
    async execute(interaction, ctx) {
      const admin = ctx.isAdmin();
      let msg =
        '🐉 **Tournois DBL — commandes**\n' +
        '`/join` `/desister` `/lier` `/tournoi` `/participants` `/monmatch` ' +
        '`/score` `/valider` `/contester` `/bracket` `/classement` `/affichage`';
      if (admin) {
        msg += '\n\n🔧 **Admin** : `/creer-tournoi` `/demarrer` `/cloturer` `/litiges` `/trancher`';
      }
      await interaction.editReply(msg);
    },
  },

  // --- Admin ---
  {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('creer-tournoi')
      .setDescription('Créer un tournoi (admin)')
      .addStringOption((o) =>
        o.setName('format').setDescription('Format').setRequired(true).addChoices(
          { name: 'Élimination simple', value: 'simple' },
          { name: 'Élimination double', value: 'double' },
          { name: 'Poules + finale', value: 'poules' },
        ))
      .addIntegerOption((o) =>
        o.setName('bo').setDescription('Best-of').setRequired(true).addChoices(
          { name: 'BO1', value: 1 },
          { name: 'BO3', value: 3 },
          { name: 'BO5', value: 5 },
        ))
      .addStringOption((o) => o.setName('nom').setDescription('Nom du tournoi').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, ctx) {
      const format = interaction.options.getString('format');
      const bestOf = interaction.options.getInteger('bo');
      const name = interaction.options.getString('nom');
      const res = await ctx.api.createTournament({ name, format, bestOf });
      await interaction.editReply(`${res.message}\n\nLes joueurs s'inscrivent avec \`/join\`, puis \`/demarrer\`.`);
    },
  },
  {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('demarrer')
      .setDescription('Démarrer le tournoi en cours (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, ctx) {
      const res = await ctx.api.startActiveTournament();
      await interaction.editReply(res.message);
    },
  },
  {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('cloturer')
      .setDescription('Clôturer le tournoi en cours (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, ctx) {
      const res = await ctx.api.closeActiveTournament();
      await interaction.editReply(res.message);
    },
  },
  {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('litiges')
      .setDescription('Lister les matchs en litige (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, ctx) {
      const res = await ctx.api.listLitiges();
      await interaction.editReply(res.message || '✅ Aucun litige.');
    },
  },
  {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('trancher')
      .setDescription('Trancher un match par son code (admin)')
      .addStringOption((o) => o.setName('code').setDescription('Code du match, ex. P2-1').setRequired(true))
      .addStringOption((o) => o.setName('score').setDescription('Score, ex. 2-1').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, ctx) {
      const code = interaction.options.getString('code').toUpperCase();
      const score = interaction.options.getString('score');
      if (!/^\d+-\d+$/.test(score)) {
        await interaction.editReply('Score invalide. Exemple : 2-1');
        return;
      }
      const res = await ctx.api.resolveByCode(code, score);
      await interaction.editReply(res.message || '✅ Match résolu.');
    },
  },
  {
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('disqualifier')
      .setDescription('Disqualifier un joueur (mention ou pseudo) (admin)')
      .addUserOption((o) => o.setName('joueur').setDescription('Mentionne le joueur (s\'il a lié son Discord)'))
      .addStringOption((o) => o.setName('pseudo').setDescription('Ou son pseudo dans le tournoi'))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, ctx) {
      const user = interaction.options.getUser('joueur');
      const pseudo = interaction.options.getString('pseudo');
      let payload;
      if (user) payload = { platform: 'discord', externalId: user.id };
      else if (pseudo) payload = { pseudo };
      else {
        await interaction.editReply('Indique un joueur : mentionne-le (option *joueur*) ou donne son *pseudo*.');
        return;
      }
      const res = await ctx.api.disqualify(payload);
      await interaction.editReply(res.message || '✅ Joueur disqualifié.');
    },
  },
];

module.exports = { commands, standingsPayload, bracketPayload };
