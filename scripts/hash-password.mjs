// 사용법: npm run hash-password -- <비밀번호>
// D1에 계정을 수동 시드할 때 password_hash 값을 만들어준다.
const password = process.argv[2]
if (!password) {
  console.error('사용법: npm run hash-password -- <비밀번호>')
  process.exit(1)
}
const enc = new TextEncoder()
const salt = crypto.getRandomValues(new Uint8Array(16))
const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
  key,
  256,
)
const b64 = (buf) => Buffer.from(buf).toString('base64')
console.log(`pbkdf2$100000$${b64(salt)}$${b64(bits)}`)
