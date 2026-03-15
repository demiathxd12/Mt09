/**
 * Simple Client-Side Encryption Utility using Web Crypto API (AES-GCM)
 * This provides an additional layer of security by encrypting message text
 * before it reaches Firestore.
 */

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

// In a real E2EE app, this would be a shared secret exchanged via DH.
// For this implementation, we derive a key from the unique chatId.
async function getEncryptionKey(chatId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(chatId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('chat-salt-123'), // Static salt for demo
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(text: string, chatId: string): Promise<string> {
  try {
    const key = await getEncryptionKey(chatId);
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(text);

    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encodedText
    );

    const encryptedArray = new Uint8Array(encryptedContent);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    return text; // Fallback to plain text if encryption fails
  }
}

export async function decryptMessage(encryptedBase64: string, chatId: string): Promise<string> {
  try {
    const key = await getEncryptionKey(chatId);
    const combined = new Uint8Array(
      atob(encryptedBase64)
        .split('')
        .map((char) => char.charCodeAt(0))
    );

    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);

    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedContent);
  } catch (error) {
    // If decryption fails, it might be an old unencrypted message
    return encryptedBase64;
  }
}
