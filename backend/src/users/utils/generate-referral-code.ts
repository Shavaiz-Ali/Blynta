import { randomBytes } from 'crypto';

// Generates a short, URL-safe, human-shareable code — e.g. "K7X9M2A4"
// Uppercase + digits only, avoids ambiguous characters (0/O, 1/I/l) for readability
// when someone types it out manually rather than clicking a link.
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 8): string {
    const bytes = randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) {
        code += CHARS[bytes[i] % CHARS.length];
    }
    return code;
}