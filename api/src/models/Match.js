const { Schema, model } = require('mongoose');

const MatchSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    round: { type: Number },
    index: { type: Number }, // position dans le tour (0-based)
    bracket: {
      type: String,
      enum: ['principal', 'perdants', 'finale', 'poule'],
      default: 'principal',
    },

    // Poules : numéro de groupe (null hors format poules).
    group: { type: Number, default: null },

    player1: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    player2: { type: Schema.Types.ObjectId, ref: 'Player', default: null },

    scoreP1: { type: Number, default: 0 },
    scoreP2: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['a_jouer', 'attente_validation', 'termine', 'litige'],
      default: 'a_jouer',
    },
    winner: { type: Schema.Types.ObjectId, ref: 'Player', default: null },

    // Flux de validation : score déclaré par un joueur, en attente de confirmation.
    reportedBy: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    pendingP1: { type: Number, default: null },
    pendingP2: { type: Number, default: null },

    // Progression : où va le gagnant.
    nextMatch: { type: Schema.Types.ObjectId, ref: 'Match', default: null },
    nextSlot: { type: Number, default: null }, // 1 ou 2

    // Double élimination : où tombe le perdant (null = éliminé).
    loserNext: { type: Schema.Types.ObjectId, ref: 'Match', default: null },
    loserSlot: { type: Number, default: null }, // 1 ou 2
  },
  { timestamps: true },
);

module.exports = model('Match', MatchSchema);
