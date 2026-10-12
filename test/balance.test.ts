import { describe, it, expect } from 'vitest'
import {
  accrualDateOf,
  accrualsBetween,
  evaluate,
  balanceAt,
  nextAccrualDate,
  isValidAmount,
  type Settings,
  type Leave,
} from '../shared/balance'

const S = (over: Partial<Settings> = {}): Settings => ({
  accrualDay: 15,
  baseDate: '2026-08-27',
  baseBalance: 2.5,
  ...over,
})

const L = (id: number, date: string, amount: number): Leave => ({
  id,
  date,
  amount,
  type: 'custom',
})

describe('accrualDateOf', () => {
  it('일반적인 발생일', () => {
    expect(accrualDateOf(2026, 9, 15)).toBe('2026-09-15')
  })
  it('발생일 31일 → 30일까지 있는 달은 말일 보정', () => {
    expect(accrualDateOf(2026, 9, 31)).toBe('2026-09-30')
    expect(accrualDateOf(2026, 10, 31)).toBe('2026-10-31')
  })
  it('2월 말일 보정 (평년/윤년)', () => {
    expect(accrualDateOf(2026, 2, 30)).toBe('2026-02-28')
    expect(accrualDateOf(2028, 2, 30)).toBe('2028-02-29')
  })
})

describe('accrualsBetween', () => {
  it('기준일 이후 도래한 발생일만 센다', () => {
    // 기준 8/27, 발생일 15 → 9/15, 10/15 = 2회
    expect(accrualsBetween(S(), '2026-10-20')).toBe(2)
  })
  it('발생일 당일 포함', () => {
    expect(accrualsBetween(S(), '2026-09-15')).toBe(1)
    expect(accrualsBetween(S(), '2026-09-14')).toBe(0)
  })
  it('기준일과 같은 달의 발생일이 기준일 이전이면 제외', () => {
    // 8/15는 기준일 8/27 이전이므로 미포함
    expect(accrualsBetween(S(), '2026-08-31')).toBe(0)
  })
  it('기준일 당일 발생은 기준 잔여에 이미 반영된 것으로 보고 제외', () => {
    expect(accrualsBetween(S({ baseDate: '2026-08-15' }), '2026-09-01')).toBe(0)
  })
  it('until이 기준일 이전이면 0', () => {
    expect(accrualsBetween(S(), '2026-08-01')).toBe(0)
  })
  it('해를 넘겨도 계산', () => {
    expect(accrualsBetween(S(), '2027-01-31')).toBe(5) // 9,10,11,12,1월
  })
})

describe('evaluate', () => {
  it('잔여가 충분하면 ok', () => {
    const r = evaluate(S(), [L(1, '2026-09-01', 1)])
    expect(r[0].status).toBe('ok')
    expect(r[0].balanceAfter).toBe(1.5)
  })
  it('잔여 부족이면 insufficient, 그래도 차감된다', () => {
    const r = evaluate(S({ baseBalance: 0 }), [
      L(1, '2026-09-01', 1), // 잔여 0 → 불가, 차감 후 -1
      L(2, '2026-09-20', 0.5), // 9/15 +1 → 잔여 0 → 불가
    ])
    expect(r[0].status).toBe('insufficient')
    expect(r[0].balanceAfter).toBe(-1)
    expect(r[1].status).toBe('insufficient')
    expect(r[1].balanceAfter).toBe(-0.5)
  })
  it('발생일 당일 사용 가능', () => {
    const r = evaluate(S({ baseBalance: 0 }), [L(1, '2026-09-15', 1)])
    expect(r[0].status).toBe('ok')
    expect(r[0].balanceAfter).toBe(0)
  })
  it('같은 날 여러 건은 id순 순차 차감', () => {
    const r = evaluate(S({ baseBalance: 0.75 }), [
      L(2, '2026-09-01', 0.5),
      L(1, '2026-09-01', 0.5),
    ])
    expect(r[0].id).toBe(1)
    expect(r[0].status).toBe('ok')
    expect(r[1].id).toBe(2)
    expect(r[1].status).toBe('insufficient')
  })
  it('기준일 이하 건은 beforeBase, 차감 없음', () => {
    const r = evaluate(S(), [L(1, '2026-08-27', 1), L(2, '2026-09-01', 1)])
    expect(r[0].status).toBe('beforeBase')
    expect(r[1].status).toBe('ok')
    expect(r[1].balanceAfter).toBe(1.5)
  })
  it('소수 둘째 자리 사용량 (0.75) 오차 없이 계산', () => {
    const r = evaluate(S({ baseBalance: 0.1 }), [
      L(1, '2026-09-01', 0.05),
      L(2, '2026-09-02', 0.05),
    ])
    expect(r[1].status).toBe('ok')
    expect(r[1].balanceAfter).toBe(0)
  })
})

describe('balanceAt', () => {
  it('기준일 당일은 기준 잔여', () => {
    expect(balanceAt(S(), [], '2026-08-27')).toBe(2.5)
  })
  it('발생·사용 반영', () => {
    const leaves = [L(1, '2026-09-16', 1)]
    expect(balanceAt(S(), leaves, '2026-09-15')).toBe(3.5)
    expect(balanceAt(S(), leaves, '2026-09-16')).toBe(2.5)
  })
  it('음수 잔여 허용', () => {
    expect(balanceAt(S({ baseBalance: 0 }), [L(1, '2026-09-01', 1)], '2026-09-01')).toBe(-1)
  })
})

describe('nextAccrualDate', () => {
  it('오늘 이후 가장 가까운 발생일', () => {
    expect(nextAccrualDate(S(), '2026-08-27')).toBe('2026-09-15')
    expect(nextAccrualDate(S(), '2026-09-14')).toBe('2026-09-15')
    expect(nextAccrualDate(S(), '2026-09-15')).toBe('2026-10-15')
  })
  it('말일 보정 케이스', () => {
    expect(nextAccrualDate(S({ accrualDay: 31 }), '2026-09-01')).toBe('2026-09-30')
  })
})

describe('isValidAmount', () => {
  it('허용: 0 초과 ~ 1 이하, 소수 둘째 자리', () => {
    for (const v of [0.01, 0.25, 0.33, 0.5, 0.75, 1]) expect(isValidAmount(v)).toBe(true)
  })
  it('거부: 0, 음수, 1 초과, 셋째 자리', () => {
    for (const v of [0, -0.5, 1.01, 1.5, 0.125, NaN, Infinity])
      expect(isValidAmount(v)).toBe(false)
  })
})
