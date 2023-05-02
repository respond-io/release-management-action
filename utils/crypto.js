const crypto = require('crypto');

class Crypto {
    // static function to generate a hash from a plain text
    static generateHash(text) {
        const hash = crypto.createHash('sha256');
        hash.update(text);
        return hash.digest('hex');
    }

}

module.exports = Crypto;