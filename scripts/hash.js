const crypto = require('crypto');
function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}
console.log(hash('directive'));
