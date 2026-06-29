/**
 * Erreur applicative renvoyée au client avec un statut HTTP et un message
 * directement affichable par les bots (champ `message`).
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

module.exports = { AppError };
