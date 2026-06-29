const Tournament = require('../models/Tournament');
const Players = require('./players');
const format = require('../utils/format');
const { AppError } = require('../utils/errors');

// Tournoi "actif" pour les actions (inscription, score…) : non terminé.
async function getActive() {
  return Tournament.findOne({ status: { $ne: 'termine' } }).sort({ createdAt: -1 });
}

// Dernier tournoi tous statuts confondus : pour l'affichage (bracket/classement),
// afin de pouvoir consulter le tableau final même après la fin du tournoi.
async function getLatest() {
  return Tournament.findOne({}).sort({ createdAt: -1 });
}

/**
 * Inscrit (platform, externalId) au tournoi actuellement ouvert.
 */
async function register(platform, externalId, pseudo) {
  const tournament = await getActive();
  if (!tournament) throw new AppError("Aucun tournoi n'est ouvert aux inscriptions.", 404);
  if (tournament.status !== 'inscription') {
    throw new AppError('Les inscriptions sont closes (le tournoi a déjà démarré).', 409);
  }

  const player = await Players.findOrCreate(platform, externalId, pseudo);

  const already = tournament.registrations.some(
    (r) => String(r.player) === String(player._id),
  );
  if (already) {
    const code = await Players.ensureLinkCode(player);
    return {
      message: `Tu es déjà inscrit au tournoi *${tournament.name}*.\n\n🔗 Code de liaison : *${code}*`,
      tournament: tournament._id,
    };
  }

  if (tournament.maxPlayers > 0 && tournament.registrations.length >= tournament.maxPlayers) {
    throw new AppError('Le tournoi est complet.', 409);
  }

  tournament.registrations.push({ player: player._id, seed: tournament.registrations.length + 1 });
  await tournament.save();

  const code = await Players.ensureLinkCode(player);
  return {
    message:
      `✅ Inscription confirmée au tournoi *${tournament.name}* ` +
      `(${tournament.registrations.length} joueur(s)).\n\n` +
      `🔗 Pour lier ton compte sur l'autre plateforme, utilise le code *${code}* avec la commande de liaison.`,
    tournament: tournament._id,
  };
}

// Désinscription (uniquement tant que les inscriptions sont ouvertes).
async function withdraw(platform, externalId) {
  const tournament = await getActive();
  if (!tournament) throw new AppError("Aucun tournoi ouvert.", 404);
  if (tournament.status !== 'inscription') {
    throw new AppError('Trop tard : le tournoi a déjà démarré.', 409);
  }
  const player = await Players.findByPlatform(platform, externalId);
  if (!player) throw new AppError("Tu n'es pas inscrit.", 404);

  const before = tournament.registrations.length;
  tournament.registrations = tournament.registrations.filter(
    (r) => String(r.player) !== String(player._id),
  );
  if (tournament.registrations.length === before) {
    throw new AppError("Tu n'es pas inscrit à ce tournoi.", 404);
  }
  await tournament.save();
  return {
    message: `✅ Désinscription confirmée du tournoi *${tournament.name}* (${tournament.registrations.length} joueur(s) restant(s)).`,
  };
}

// Liste des participants inscrits.
async function participantsMessage() {
  const tournament = await getLatest();
  if (!tournament) return { message: 'Aucun tournoi pour le moment.' };
  await tournament.populate('registrations.player');

  const regs = tournament.registrations;
  if (!regs.length) return { message: `Aucun inscrit pour *${tournament.name}*.` };

  const lines = regs.map((r, i) => {
    const p = r.player;
    const plat = format.playerPlatform(p);
    const tag = plat === 'both' ? 'WA+DC' : plat === 'discord' ? 'DC' : plat === 'whatsapp' ? 'WA' : '';
    return `${i + 1}. ${p ? p.pseudo : '?'}${tag ? ` [${tag}]` : ''}`;
  });
  return {
    message: `👥 *Participants — ${tournament.name}* (${regs.length})\n${lines.join('\n')}`,
  };
}

// Infos résumées du tournoi en cours.
async function infoMessage() {
  const tournament = await getLatest();
  if (!tournament) return { message: 'Aucun tournoi pour le moment.' };

  const statusLabel = {
    inscription: '📝 Inscriptions ouvertes',
    en_cours: '⚔️ En cours',
    termine: '🏁 Terminé',
  }[tournament.status] || tournament.status;

  const lines = [
    `🏆 *${tournament.name}*`,
    `Format : ${format.formatLabel(tournament.format)} (BO${tournament.bestOf})`,
    `Statut : ${statusLabel}`,
    `Inscrits : ${tournament.registrations.length}`,
  ];
  if (tournament.format === 'poules') {
    lines.push(`Poules : groupes de ${tournament.poolSize}, ${tournament.qualifiersPerPool} qualifiés/groupe`);
  }
  return { message: lines.join('\n') };
}

module.exports = {
  register,
  withdraw,
  participantsMessage,
  infoMessage,
  getActive,
  getLatest,
};
