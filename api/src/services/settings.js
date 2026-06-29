const Settings = require('../models/Settings');
const { AppError } = require('../utils/errors');

function pick(s) {
  return {
    standingsMode: s.standingsMode,
    bracketMode: s.bracketMode,
    showPlatform: s.showPlatform,
  };
}

async function getDisplay() {
  let s = await Settings.findOne({ key: 'display' });
  if (!s) s = await Settings.create({ key: 'display' });
  return pick(s);
}

async function updateDisplay(patch = {}) {
  const allowed = {};
  if (['image', 'texte'].includes(patch.standingsMode)) allowed.standingsMode = patch.standingsMode;
  if (['image', 'texte'].includes(patch.bracketMode)) allowed.bracketMode = patch.bracketMode;
  if (typeof patch.showPlatform === 'boolean') allowed.showPlatform = patch.showPlatform;

  if (!Object.keys(allowed).length) {
    throw new AppError('Aucun réglage valide fourni.', 400);
  }

  const s = await Settings.findOneAndUpdate(
    { key: 'display' },
    { $set: allowed },
    { new: true, upsert: true },
  );
  return { message: "✅ Réglages d'affichage mis à jour.", display: pick(s) };
}

module.exports = { getDisplay, updateDisplay };
