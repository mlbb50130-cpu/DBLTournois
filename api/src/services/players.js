const crypto = require('crypto');
const Player = require('../models/Player');
const { AppError } = require('../utils/errors');

// Champ d'identité selon la plateforme.
function platformField(platform) {
  if (platform === 'discord') return 'discordId';
  if (platform === 'whatsapp') return 'whatsappNumber';
  throw new AppError(`Plateforme inconnue : ${platform}`, 400);
}

function genLinkCode() {
  return `DBL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function findByPlatform(platform, externalId) {
  return Player.findOne({ [platformField(platform)]: externalId });
}

async function findOrCreate(platform, externalId, pseudo) {
  if (!externalId) throw new AppError('Identifiant joueur manquant.', 400);
  const field = platformField(platform);

  let player = await Player.findOne({ [field]: externalId });
  if (!player) {
    player = new Player({ [field]: externalId, pseudo: pseudo || 'Joueur' });
    await player.save();
  } else if (pseudo && player.pseudo !== pseudo) {
    player.pseudo = pseudo;
    await player.save();
  }
  return player;
}

async function ensureLinkCode(player) {
  if (!player.linkCode) {
    player.linkCode = genLinkCode();
    await player.save();
  }
  return player.linkCode;
}

/**
 * Lie le compte (platform, externalId) au joueur identifié par `code`.
 */
async function link(platform, externalId, code) {
  if (!externalId) throw new AppError('Identifiant joueur manquant.', 400);
  if (!code) throw new AppError('Code de liaison manquant.', 400);

  const field = platformField(platform);
  const target = await Player.findOne({ linkCode: code });
  if (!target) throw new AppError('Code de liaison invalide ou expiré.', 404);

  const existing = await Player.findOne({ [field]: externalId });
  if (existing && String(existing._id) === String(target._id)) {
    return { message: `✅ Ton compte ${platform} est déjà lié à *${target.pseudo}*.` };
  }
  // Un doublon existe sur cette plateforme : on le retire au profit du compte cible.
  if (existing) {
    await Player.deleteOne({ _id: existing._id });
  }

  target[field] = externalId;
  target.linkCode = undefined; // code à usage unique
  await target.save();

  return {
    message: `✅ Comptes liés ! Ton compte ${platform} est désormais rattaché à *${target.pseudo}*.`,
  };
}

module.exports = {
  platformField,
  findByPlatform,
  findOrCreate,
  ensureLinkCode,
  link,
};
