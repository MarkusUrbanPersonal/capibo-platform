const encoder = new TextEncoder()
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

/** `bytes` random bytes as hex. Call from actions, where randomness is real. */
export function randomHex(bytes) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)))
}
