// 연차 잔여 계산 핵심 로직 (프런트/워커 공용, 순수 함수)
// 금액은 부동소수점 오차를 피하기 위해 내부적으로 ×100 정수(센트)로 계산한다.

export type LeaveType = 'full' | 'half' | 'quarter' | 'custom'

export interface Leave {
  id: number
  date: string // 'YYYY-MM-DD'
  amount: number // 0 < amount <= 1, 소수 둘째 자리
  type: LeaveType
}

export interface Settings {
  accrualDay: number // 1~31, 매달 이 날짜에 +1 (없는 달은 말일)
  baseDate: string // 'YYYY-MM-DD' 기준일
  baseBalance: number // 기준일 시점 잔여 연차
}

export type LeaveStatus = 'ok' | 'insufficient' | 'beforeBase'

export interface EvaluatedLeave {
  id: number
  date: string
  amount: number
  type: LeaveType
  status: LeaveStatus
  /** 이 건 차감 후 잔여 (beforeBase 건은 기준 잔여 그대로) */
  balanceAfter: number
}

const toCents = (n: number) => Math.round(n * 100)
const fromCents = (c: number) => c / 100

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 해당 연·월의 실제 발생일 ('YYYY-MM-DD'). 발생일이 그 달에 없으면 말일. */
export function accrualDateOf(year: number, month1: number, accrualDay: number): string {
  const day = Math.min(accrualDay, lastDayOfMonth(year, month1))
  return `${year}-${pad2(month1)}-${pad2(day)}`
}

/** 기준일 초과 ~ until 이하 기간에 도래한 발생일 횟수 */
export function accrualsBetween(s: Settings, until: string): number {
  if (until <= s.baseDate) return 0
  let [y, m] = s.baseDate.split('-').map(Number)
  const [uy, um] = until.split('-').map(Number)
  let count = 0
  while (y < uy || (y === uy && m <= um)) {
    const d = accrualDateOf(y, m, s.accrualDay)
    if (d > s.baseDate && d <= until) count++
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return count
}

/** 날짜순(동일 날짜는 id순) 정렬 */
export function sortLeaves(leaves: Leave[]): Leave[] {
  return [...leaves].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id))
}

/**
 * 등록된 모든 연차 건을 날짜순 순차 차감으로 평가한다.
 * - 기준일 이하 날짜의 건은 beforeBase (계산 대상 아님, 차감도 안 함)
 * - 불가(insufficient) 건도 등록된 그대로 차감한다 (PRD §8 확정)
 */
export function evaluate(s: Settings, leaves: Leave[]): EvaluatedLeave[] {
  const sorted = sortLeaves(leaves)
  const result: EvaluatedLeave[] = []
  let usedCents = 0
  for (const leave of sorted) {
    if (leave.date <= s.baseDate) {
      result.push({ ...leave, status: 'beforeBase', balanceAfter: s.baseBalance })
      continue
    }
    const availableCents =
      toCents(s.baseBalance) + accrualsBetween(s, leave.date) * 100 - usedCents
    const amountCents = toCents(leave.amount)
    const ok = availableCents >= amountCents
    usedCents += amountCents
    result.push({
      ...leave,
      status: ok ? 'ok' : 'insufficient',
      balanceAfter: fromCents(availableCents - amountCents),
    })
  }
  return result
}

/** 특정 날짜 시점 잔여 (그 날짜의 발생·사용까지 포함) */
export function balanceAt(s: Settings, leaves: Leave[], date: string): number {
  if (date < s.baseDate) return s.baseBalance
  let cents = toCents(s.baseBalance) + accrualsBetween(s, date) * 100
  for (const leave of leaves) {
    if (leave.date > s.baseDate && leave.date <= date) cents -= toCents(leave.amount)
  }
  return fromCents(cents)
}

/** 오늘 이후 가장 가까운 발생일 */
export function nextAccrualDate(s: Settings, from: string): string {
  let [y, m] = from.split('-').map(Number)
  for (let i = 0; i < 24; i++) {
    const d = accrualDateOf(y, m, s.accrualDay)
    if (d > from) return d
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return accrualDateOf(y, m, s.accrualDay)
}

/** 사용량 입력 검증: 0 초과 ~ 1.00 이하, 소수 둘째 자리까지 (PRD §8) */
export function isValidAmount(amount: number): boolean {
  if (!Number.isFinite(amount)) return false
  if (amount <= 0 || amount > 1) return false
  return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-9
}
