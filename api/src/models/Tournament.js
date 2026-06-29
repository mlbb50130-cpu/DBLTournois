const { Schema, model } = require('mongoose');

const TournamentSchema = new Schema(
  {
    name: { type: String, required: true },
    game: { type: String, default: 'DBL' },
    format: { type: String, enum: ['simple', 'double', 'poules'], default: 'simple' },
    bestOf: { type: Number, default: 3 },
    status: {
      type: String,
      enum: ['inscription', 'en_cours', 'termine'],
      default: 'inscription',
    },
    maxPlayers: { type: Number, default: 0 }, // 0 = illimité

    // Format poules : taille des groupes + nombre de qualifiés par groupe.
    poolSize: { type: Number, default: 4 },
    qualifiersPerPool: { type: Number, default: 2 },
    finalGenerated: { type: Boolean, default: false }, // bracket final des poules créé ?
    disqualified: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    registrations: [
      {
        _id: false,
        player: { type: Schema.Types.ObjectId, ref: 'Player' },
        seed: Number,
      },
    ],
    champion: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
  },
  { timestamps: true },
);

module.exports = model('Tournament', TournamentSchema);
