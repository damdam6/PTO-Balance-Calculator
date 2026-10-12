// /api fetch 래퍼. 401이면 ApiError(status=401)를 던진다.

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...init,
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? res.statusText))
  return body as T
}

export interface ApiSettings {
  accrualDay: number
  baseDate: string
  baseBalance: number
}

export interface ApiLeave {
  id: number
  date: string
  amount: number
  type: 'full' | 'half' | 'quarter' | 'custom'
}

export const api = {
  login: (username: string, password: string) =>
    request<{ ok: true }>('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  signup: (username: string, password: string, code?: string) =>
    request<{ ok: true }>('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, code: code || undefined }),
    }),
  logout: () => request<{ ok: true }>('/api/logout', { method: 'POST' }),
  me: () => request<{ username: string }>('/api/me'),
  getSettings: () => request<{ settings: ApiSettings | null }>('/api/settings'),
  putSettings: (s: ApiSettings) =>
    request<{ ok: true }>('/api/settings', { method: 'PUT', body: JSON.stringify(s) }),
  listLeaves: () => request<{ leaves: ApiLeave[] }>('/api/leaves'),
  createLeave: (l: Omit<ApiLeave, 'id'>) =>
    request<{ id: number }>('/api/leaves', { method: 'POST', body: JSON.stringify(l) }),
  updateLeave: (id: number, l: Omit<ApiLeave, 'id'>) =>
    request<{ ok: true }>(`/api/leaves/${id}`, { method: 'PUT', body: JSON.stringify(l) }),
  deleteLeave: (id: number) => request<{ ok: true }>(`/api/leaves/${id}`, { method: 'DELETE' }),
}
