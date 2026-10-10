import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SealedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: string;
}

@Injectable()
export class CredentialVault {
  constructor(private readonly config: ConfigService) {}
  private key(version: string) {
    try {
      const keys: unknown = JSON.parse(
        this.config.get<string>('AI_CREDENTIAL_KEYS', '{}'),
      );
      const encoded =
        keys && typeof keys === 'object'
          ? (keys as Record<string, unknown>)[version]
          : undefined;
      if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encoded))
        throw new Error();
      const key = Buffer.from(encoded, 'base64');
      if (key.length !== 32) throw new Error();
      return key;
    } catch {
      throw new ServiceUnavailableException(
        'AI credential encryption key is unavailable',
      );
    }
  }
  encrypt(secret: string, identity: string): SealedSecret {
    const keyVersion = this.config.get<string>(
      'AI_CREDENTIAL_KEY_VERSION',
      'v1',
    );
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(keyVersion), iv);
    cipher.setAAD(Buffer.from(identity + ':' + keyVersion));
    return {
      ciphertext: Buffer.concat([
        cipher.update(secret, 'utf8'),
        cipher.final(),
      ]).toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      keyVersion,
    };
  }
  decrypt(value: SealedSecret, identity: string): string {
    try {
      const iv = Buffer.from(value.iv, 'base64');
      const tag = Buffer.from(value.tag, 'base64');
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key(value.keyVersion),
        iv,
      );
      decipher.setAAD(Buffer.from(identity + ':' + value.keyVersion));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'AI credential could not be authenticated',
      );
    }
  }
}
