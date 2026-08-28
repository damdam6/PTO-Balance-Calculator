// PBKDF2 비밀번호 해시 + HMAC 서명 세션 쿠키 (Web Crypto만 사용)

const PBKDF2_ITERATIONS = 100_000
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30 // 30일

const enc = new TextEncoder()

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function b64decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
}

/** 저장 형식: pbkdf2$<iterations>$<salt b64>$<hash b64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt.buffer)}$${b64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  const salt = b64decode(parts[2])
  const expected = b64decode(parts[3])
  const actual = new Uint8Array(await pbkdf2(password, salt, iterations))
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

/** 세션 토큰: base64(userId.expiresEpochSec).서명 */
export async function createSessionToken(secret: string, userId: number): Promise<string> {
  const payload = btoa(`${userId}.${Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC}`)
  return `${payload}.${await hmac(secret, payload)}`
}

export async function verifySessionToken(secret: string, token: string): Promise<number | null> {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (sig !== (await hmac(secret, payload))) return null
  let decoded: string
  try {
    decoded = atob(payload)
  } catch {
    return null
  }
  const [userIdStr, expStr] = decoded.split('.')
  const userId = Number(userIdStr)
  const exp = Number(expStr)
  if (!Number.isInteger(userId) || !Number.isFinite(exp)) return null
  if (exp < Date.now() / 1000) return null
  return userId
}

export const SESSION_COOKIE = 'session'
export const SESSION_MAX_AGE = SESSION_MAX_AGE_SEC
