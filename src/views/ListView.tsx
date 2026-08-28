import { Badge, Group, Paper, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import type { EvaluatedLeave } from '../../shared/balance'
import { STATUS_COLORS } from '../theme'

const TYPE_LABEL: Record<EvaluatedLeave['type'], string> = {
  full: '연차',
  half: '반차',
  quarter: '반반차',
  custom: '직접',
}

const STATUS_LABEL: Record<EvaluatedLeave['status'], string> = {
  ok: '사용 가능',
  insufficient: '연차 부족',
  beforeBase: '기준일 이전',
}

export default function ListView({
  evaluated,
  onSelect,
}: {
  evaluated: EvaluatedLeave[]
  onSelect: (leave: EvaluatedLeave) => void
}) {
  if (evaluated.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl" size="sm">
        등록된 연차가 없습니다. + 버튼으로 등록하세요.
      </Text>
    )
  }
  return (
    <Stack gap="xs">
      {evaluated.map((l) => (
        <Paper
          key={l.id}
          withBorder
          radius="md"
          p="sm"
          onClick={() => onSelect(l)}
          style={{ cursor: 'pointer', opacity: l.status === 'beforeBase' ? 0.6 : 1 }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={0}>
              <Text fw={600} size="sm">
                {dayjs(l.date).format('M월 D일 (dd)')}
              </Text>
              <Text size="xs" c="dimmed">
                {TYPE_LABEL[l.type]} · {l.amount}일 사용
                {l.status !== 'beforeBase' && <> · 사용 후 잔여 {l.balanceAfter}일</>}
              </Text>
            </Stack>
            <Badge color={STATUS_COLORS[l.status]} variant="filled">
              {STATUS_LABEL[l.status]}
            </Badge>
          </Group>
        </Paper>
      ))}
    </Stack>
  )
}
