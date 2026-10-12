import { Badge, Divider, Group, Paper, Stack, Text } from '@mantine/core'
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

function LeaveRow({
  leave: l,
  used,
  onSelect,
}: {
  leave: EvaluatedLeave
  used: boolean
  onSelect: (leave: EvaluatedLeave) => void
}) {
  // 이미 지난(사용한) 연차는 행 전체를 회색 처리
  const dimmed = used || l.status === 'beforeBase'
  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      onClick={() => onSelect(l)}
      bg={used ? 'gray.1' : undefined}
      style={{ cursor: 'pointer', opacity: dimmed ? 0.6 : 1 }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={0}>
          <Text fw={600} size="sm" c={used ? 'dimmed' : undefined}>
            {dayjs(l.date).format('M월 D일 (dd)')}
          </Text>
          <Text size="xs" c="dimmed">
            {TYPE_LABEL[l.type]} · {l.amount}일 사용
            {l.status !== 'beforeBase' && <> · 사용 후 잔여 {l.balanceAfter}일</>}
          </Text>
        </Stack>
        <Badge color={used ? 'gray' : STATUS_COLORS[l.status]} variant="filled">
          {used ? '사용 완료' : STATUS_LABEL[l.status]}
        </Badge>
      </Group>
    </Paper>
  )
}

export default function ListView({
  evaluated,
  today,
  onSelect,
}: {
  evaluated: EvaluatedLeave[]
  today: string
  onSelect: (leave: EvaluatedLeave) => void
}) {
  if (evaluated.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl" size="sm">
        등록된 연차가 없습니다. + 버튼으로 등록하세요.
      </Text>
    )
  }
  // 오늘 이전 날짜는 이미 사용한 연차 → 리스트 하단으로 분리 (YYYY-MM-DD 문자열 비교)
  const upcoming = evaluated.filter((l) => l.date >= today)
  const used = evaluated.filter((l) => l.date < today)
  return (
    <Stack gap="xs">
      {upcoming.length === 0 && (
        <Text c="dimmed" ta="center" py="md" size="sm">
          예정된 연차가 없습니다.
        </Text>
      )}
      {upcoming.map((l) => (
        <LeaveRow key={l.id} leave={l} used={false} onSelect={onSelect} />
      ))}
      {used.length > 0 && (
        <>
          <Divider my="xs" label={`사용한 연차 ${used.length}건`} labelPosition="center" />
          {used.map((l) => (
            <LeaveRow key={l.id} leave={l} used onSelect={onSelect} />
          ))}
        </>
      )}
    </Stack>
  )
}
