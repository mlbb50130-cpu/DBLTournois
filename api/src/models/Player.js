const { Schema, model } = require('mongoose');

const PlayerSchema = new Schema(
  {
    pseudo: { type: String, default: 'Joueur' },
    dblFriendId: { type: String, default: '' },

    // Identifiants par plateforme (un joueur peut avoir les deux après liaison).
    discordId: { type: String },
    whatsappNumber: { type: String },

    // Code de liaison à usage unique (cf. flux de liaison dans DESIGN.md).
    linkCode: { type: String },
  },
  { timestamps: true },
);

// Index uniques "sparse" : ignorent les documents où le champ est absent.
PlayerSchema.index({ discordId: 1 }, { unique: true, sparse: true });
PlayerSchema.index({ whatsappNumber: 1 }, { unique: true, sparse: true });
PlayerSchema.index({ linkCode: 1 }, { sparse: true });

module.exports = model('Player', PlayerSchema);
