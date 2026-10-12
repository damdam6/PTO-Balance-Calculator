import { Group, Paper, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import { balanceAt, nextAccrualDate, type Leave, type Settings } from '../../shared/balance'

function BalanceValue({ value }: { value: number }) {
  return (
    <Text size="xl" fw={800} c={value < 0 ? 'red' : undefined}>
      {value}
      <Text span size="sm" fw={500} c="dimmed">
        {' '}
        일
      </Text>
    </Text>
  )
}

export default function SummaryBar({
  settings,
  leaves,
  selectedDate,
  today,
}: {
  settings: Settings
  leaves: Leave[]
  selectedDate: string
  today: string
}) {
  const todayBalance = balanceAt(settings, leaves, today)
  const selectedBalance = balanceAt(settings, leaves, selectedDate)
  const next = nextAccrualDate(settings, today)

  return (
    <Paper withBorder radius="lg" p="md">
      <Group grow>
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            오늘 잔여 ({dayjs(today).format('M/D')})
          </Text>
          <BalanceValue value={todayBalance} />
        </Stack>
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            선택 날짜 잔여 ({dayjs(selectedDate).format('M/D')})
          </Text>
          <BalanceValue value={selectedBalance} />
        </Stack>
      </Group>
      <Text size="xs" c="dimmed" mt={6}>
        다음 발생일: {dayjs(next).format('M월 D일')} (+1)
      </Text>
    </Paper>
  )
}
