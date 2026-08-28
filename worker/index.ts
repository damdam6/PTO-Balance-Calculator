import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from './auth'
import { isValidAmount } from '../shared/balance'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  SESSION_SECRET: string
  // 최초 부팅 시 계정 시드용 (선택): wrangler secret 또는 vars
  SEED_USERNAME?: string
  SEED_PASSWORD?: string
}

type Vars = { userId: number }

const app = new Hono<{ Bindings: Env; Variables: Vars }>()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const LEAVE_TYPES = ['full', 'half', 'quarter', 'custom'] as const

function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

// ---- 인증 ----

app.post('/api/login', async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>().catch(() => null)
  if (!body?.username || !body?.password) return c.json({ error: 'bad_request' }, 400)

  // 계정이 하나도 없고 시드 정보가 설정돼 있으면 최초 1회 자동 생성
  let user = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE username = ?')
    .bind(body.username)
    .first<{ id: number; password_hash: string }>()
  if (!user && c.env.SEED_USERNAME && c.env.SEED_PASSWORD) {
    const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
    if (count?.n === 0 && body.username === c.env.SEED_USERNAME) {
      const hash = await hashPassword(c.env.SEED_PASSWORD)
      await c.env.DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        .bind(c.env.SEED_USERNAME, hash)
        .run()
      user = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE username = ?')
        .bind(body.username)
        .first<{ id: number; password_hash: string }>()
    }
  }

  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  const token = await createSessionToken(c.env.SESSION_SECRET, user.id)
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return c.json({ ok: true })
})

app.post('/api/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

// 이하 라우트는 세션 필수
app.use('/api/*', async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  const userId = token ? await verifySessionToken(c.env.SESSION_SECRET, token) : null
  if (userId === null) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', userId)
  await next()
})

app.get('/api/me', async (c) => {
  const row = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?')
    .bind(c.get('userId'))
    .first<{ username: string }>()
  if (!row) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ username: row.username })
})

// ---- 설정 ----

app.get('/api/settings', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT accrual_day, base_date, base_balance FROM settings WHERE user_id = ?',
  )
    .bind(c.get('userId'))
    .first<{ accrual_day: number; base_date: string; base_balance: number }>()
  if (!row) return c.json({ settings: null })
  return c.json({
    settings: {
      accrualDay: row.accrual_day,
      baseDate: row.base_date,
      baseBalance: row.base_balance,
    },
  })
})

app.put('/api/settings', async (c) => {
  const body = await c.req
    .json<{ accrualDay?: number; baseDate?: string; baseBalance?: number }>()
    .catch(() => null)
  if (
    !body ||
    !Number.isInteger(body.accrualDay) ||
    body.accrualDay! < 1 ||
    body.accrualDay! > 31 ||
    !isValidDate(body.baseDate) ||
    typeof body.baseBalance !== 'number' ||
    !Number.isFinite(body.baseBalance)
  ) {
    return c.json({ error: 'bad_request' }, 400)
  }
  const balance = Math.round(body.baseBalance * 100) / 100
  await c.env.DB.prepare(
    `INSERT INTO settings (user_id, accrual_day, base_date, base_balance) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET accrual_day = ?2, base_date = ?3, base_balance = ?4`,
  )
    .bind(c.get('userId'), body.accrualDay, body.baseDate, balance)
    .run()
  return c.json({ ok: true })
})

// ---- 연차 CRUD ----

function parseLeaveBody(body: unknown): { date: string; amount: number; type: string } | null {
  if (typeof body !== 'object' || body === null) return null
  const { date, amount, type } = body as Record<string, unknown>
  if (!isValidDate(date)) return null
  if (typeof amount !== 'number' || !isValidAmount(amount)) return null
  if (typeof type !== 'string' || !LEAVE_TYPES.includes(type as never)) return null
  return { date, amount: Math.round(amount * 100) / 100, type }
}

app.get('/api/leaves', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, date, amount, type FROM leaves WHERE user_id = ? ORDER BY date ASC, id ASC',
  )
    .bind(c.get('userId'))
    .all<{ id: number; date: string; amount: number; type: string }>()
  return c.json({ leaves: results })
})

app.post('/api/leaves', async (c) => {
  const parsed = parseLeaveBody(await c.req.json().catch(() => null))
  if (!parsed) return c.json({ error: 'bad_request' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO leaves (user_id, date, amount, type) VALUES (?, ?, ?, ?)',
  )
    .bind(c.get('userId'), parsed.date, parsed.amount, parsed.type)
    .run()
  return c.json({ id: r.meta.last_row_id })
})

app.put('/api/leaves/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'bad_request' }, 400)
  const parsed = parseLeaveBody(await c.req.json().catch(() => null))
  if (!parsed) return c.json({ error: 'bad_request' }, 400)
  const r = await c.env.DB.prepare(
    'UPDATE leaves SET date = ?, amount = ?, type = ? WHERE id = ? AND user_id = ?',
  )
    .bind(parsed.date, parsed.amount, parsed.type, id, c.get('userId'))
    .run()
  if (r.meta.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})

app.delete('/api/leaves/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'bad_request' }, 400)
  const r = await c.env.DB.prepare('DELETE FROM leaves WHERE id = ? AND user_id = ?')
    .bind(id, c.get('userId'))
    .run()
  if (r.meta.changes === 0) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})

app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))

export default app
