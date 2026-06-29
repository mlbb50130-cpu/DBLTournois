const { Schema, model } = require('mongoose');

// Réglages globaux d'affichage (singleton key='display').
const SettingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: 'display' },
    standingsMode: { type: String, enum: ['image', 'texte'], default: 'image' },
    bracketMode: { type: String, enum: ['image', 'texte'], default: 'image' },
    showPlatform: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = model('Settings', SettingsSchema);
