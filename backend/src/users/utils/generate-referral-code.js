"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferralCode = generateReferralCode;
var crypto_1 = require("crypto");
// Generates a short, URL-safe, human-shareable code — e.g. "K7X9M2A4"
// Uppercase + digits only, avoids ambiguous characters (0/O, 1/I/l) for readability
// when someone types it out manually rather than clicking a link.
var CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateReferralCode(length) {
    if (length === void 0) { length = 8; }
    var bytes = (0, crypto_1.randomBytes)(length);
    var code = '';
    for (var i = 0; i < length; i++) {
        code += CHARS[bytes[i] % CHARS.length];
    }
    return code;
}
