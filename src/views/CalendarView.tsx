import { Calendar } from '@mantine/dates'
import dayjs from 'dayjs'
import {
  accrualDateOf,
  type EvaluatedLeave,
  type Settings,
} from '../../shared/balance'
import { STATUS_COLORS } from '../theme'

/** 해당 날짜가 그 달의 연차 발생일인지 */
function isAccrualDate(s: Settings, date: string): boolean {
  const [y, m] = date.split('-').map(Number)
  return accrualDateOf(y, m, s.accrualDay) === date && date > s.baseDate
}

export default function CalendarView({
  settings,
  evaluated,
  selectedDate,
  onSelectDate,
}: {
  settings: Settings
  evaluated: EvaluatedLeave[]
  selectedDate: string
  onSelectDate: (date: string) => void
}) {
  const byDate = new Map<string, EvaluatedLeave[]>()
  for (const l of evaluated) {
    const list = byDate.get(l.date) ?? []
    list.push(l)
    byDate.set(l.date, list)
  }

  return (
    <Calendar
      className="pto-calendar"
      defaultDate={selectedDate}
      hideOutsideDates
      getDayProps={(date) => ({
        selected: date === selectedDate,
        onClick: () => onSelectDate(date),
      })}
      renderDay={(date) => {
        const leaves = byDate.get(date)
        const accrual = isAccrualDate(settings, date)
        return (
          <div className="pto-day">
            <span>{dayjs(date).date()}</span>
            {leaves?.map((l) => (
              <span
                key={l.id}
                className="pto-day-badge"
                style={{
                  background: `var(--mantine-color-${STATUS_COLORS[l.status]}-6)`,
                }}
              >
                -{l.amount}
              </span>
            ))}
            {!leaves?.length && accrual && <span className="pto-day-accrual">+1</span>}
          </div>
        )
      }}
    />
  )
}
