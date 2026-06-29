const config = require('../config');

// Un numéro est admin s'il figure dans ADMIN_NUMBERS.
// Liste vide = tout le monde est admin (pratique en développement).
function isAdmin(number) {
  const admins = config.ADMIN_NUMBERS;
  return !admins.length || admins.includes(number);
}

module.exports = { isAdmin };
