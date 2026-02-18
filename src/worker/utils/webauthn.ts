/* ============================================================
   EYES ONLY — WebAuthn Utilities
   Server-side WebAuthn (Passkey) verification helpers.
   ============================================================ */

// Base64url encoding/decoding utilities
export function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64urlDecode(str: string): ArrayBuffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binaryStr = atob(str);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate random challenge for WebAuthn
export function generateChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes.buffer);
}

// Verify WebAuthn attestation (registration)
export async function verifyAttestation(
  attestationObject: ArrayBuffer,
  clientDataJSON: ArrayBuffer,
  challenge: string,
  origin: string,
): Promise<{ credentialId: ArrayBuffer; publicKey: ArrayBuffer; counter: number }> {
  // Parse clientDataJSON
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

  // Verify type
  if (clientData.type !== 'webauthn.create') {
    throw new Error('Invalid attestation type');
  }

  // Verify challenge
  if (clientData.challenge !== challenge) {
    throw new Error('Challenge mismatch');
  }

  // Verify origin
  if (clientData.origin !== origin) {
    throw new Error('Origin mismatch');
  }

  // Parse attestation object using CBOR
  const attestation = parseCBOR(new Uint8Array(attestationObject));
  const authData = parseAuthenticatorData(attestation.authData);

  return {
    credentialId: authData.credentialId,
    publicKey: authData.publicKey,
    counter: authData.counter,
  };
}

// Verify WebAuthn assertion (login)
export async function verifyAssertion(
  authenticatorData: ArrayBuffer,
  clientDataJSON: ArrayBuffer,
  signature: ArrayBuffer,
  publicKey: ArrayBuffer,
  challenge: string,
  origin: string,
  storedCounter: number,
): Promise<{ counter: number }> {
  // Parse clientDataJSON
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

  // Verify type
  if (clientData.type !== 'webauthn.get') {
    throw new Error('Invalid assertion type');
  }

  // Verify challenge
  if (clientData.challenge !== challenge) {
    throw new Error('Challenge mismatch');
  }

  // Verify origin
  if (clientData.origin !== origin) {
    throw new Error('Origin mismatch');
  }

  // Parse authenticator data
  const authData = new Uint8Array(authenticatorData);
  const counter = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0, false);

  // Verify counter (replay attack protection)
  if (counter !== 0 && counter <= storedCounter) {
    throw new Error('Invalid counter - possible replay attack');
  }

  // Verify signature
  const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataJSON);
  const signedData = new Uint8Array(authenticatorData.byteLength + clientDataHash.byteLength);
  signedData.set(new Uint8Array(authenticatorData), 0);
  signedData.set(new Uint8Array(clientDataHash), authenticatorData.byteLength);

  // Import public key
  const key = await crypto.subtle.importKey(
    'spki',
    publicKey,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['verify'],
  );

  // Verify signature
  const valid = await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    key,
    signature,
    signedData,
  );

  if (!valid) {
    throw new Error('Invalid signature');
  }

  return { counter };
}

// Parse CBOR (simplified for WebAuthn attestation objects)
function parseCBOR(bytes: Uint8Array): any {
  // This is a simplified CBOR parser for WebAuthn
  // In production, use a proper CBOR library
  let offset = 0;

  function readByte(): number {
    return bytes[offset++];
  }

  function readBytes(length: number): Uint8Array {
    const result = bytes.slice(offset, offset + length);
    offset += length;
    return result;
  }

  function parseValue(): any {
    const byte = readByte();
    const majorType = byte >> 5;
    const additionalInfo = byte & 0x1f;

    switch (majorType) {
      case 0: // unsigned integer
        return additionalInfo < 24 ? additionalInfo : readInteger(additionalInfo);
      case 1: // negative integer
        return -(additionalInfo < 24 ? additionalInfo : readInteger(additionalInfo)) - 1;
      case 2: // byte string
        const byteLength = additionalInfo < 24 ? additionalInfo : readInteger(additionalInfo);
        return readBytes(byteLength);
      case 3: // text string
        const textLength = additionalInfo < 24 ? additionalInfo : readInteger(additionalInfo);
        return new TextDecoder().decode(readBytes(textLength));
      case 5: // map
        const mapSize = additionalInfo < 24 ? additionalInfo : readInteger(additionalInfo);
        const map: any = {};
        for (let i = 0; i < mapSize; i++) {
          const key = parseValue();
          const value = parseValue();
          map[key] = value;
        }
        return map;
      default:
        throw new Error(`Unsupported CBOR major type: ${majorType}`);
    }
  }

  function readInteger(additionalInfo: number): number {
    if (additionalInfo === 24) return readByte();
    if (additionalInfo === 25) {
      const value = (readByte() << 8) | readByte();
      return value;
    }
    if (additionalInfo === 26) {
      return (readByte() << 24) | (readByte() << 16) | (readByte() << 8) | readByte();
    }
    throw new Error('Unsupported integer size');
  }

  return parseValue();
}

// Parse authenticator data
function parseAuthenticatorData(authData: Uint8Array): {
  rpIdHash: Uint8Array;
  flags: number;
  counter: number;
  credentialId: ArrayBuffer;
  publicKey: ArrayBuffer;
} {
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const counter = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0, false);

  // If attestation data is present (AT flag set)
  if (flags & 0x40) {
    const aaguid = authData.slice(37, 53);
    const credIdLength = (authData[53] << 8) | authData[54];
    const credentialId = authData.slice(55, 55 + credIdLength);
    const publicKeyBytes = authData.slice(55 + credIdLength);

    // Parse COSE public key
    const publicKey = parseCOSEPublicKey(publicKeyBytes);

    return {
      rpIdHash,
      flags,
      counter,
      credentialId: credentialId.buffer,
      publicKey,
    };
  }

  return {
    rpIdHash,
    flags,
    counter,
    credentialId: new ArrayBuffer(0),
    publicKey: new ArrayBuffer(0),
  };
}

// Parse COSE public key (ES256)
function parseCOSEPublicKey(bytes: Uint8Array): ArrayBuffer {
  // This is a simplified COSE parser for ES256 keys
  // In production, use a proper COSE library
  const coseKey = parseCBOR(bytes);

  // Extract x and y coordinates (COSE key type 2 = EC2)
  const x = coseKey[-2]; // x coordinate
  const y = coseKey[-3]; // y coordinate

  // Convert to SPKI format for Web Crypto API
  const spkiHeader = new Uint8Array([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04,
  ]);

  const publicKey = new Uint8Array(spkiHeader.length + x.length + y.length);
  publicKey.set(spkiHeader, 0);
  publicKey.set(x, spkiHeader.length);
  publicKey.set(y, spkiHeader.length + x.length);

  return publicKey.buffer;
}
