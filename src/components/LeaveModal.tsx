import { useEffect, useState } from 'react'
import {
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { isValidAmount, type Leave, type LeaveType } from '../../shared/balance'

const TYPE_AMOUNT: Record<Exclude<LeaveType, 'custom'>, number> = {
  full: 1,
  half: 0.5,
  quarter: 0.25,
}

export interface LeaveDraft {
  date: string
  amount: number
  type: LeaveType
}

export default function LeaveModal({
  opened,
  initial,
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  opened: boolean
  /** 새 등록 시 기본 날짜, 수정 시 기존 건 */
  initial: { date: string } | Leave
  editing: boolean
  onClose: () => void
  onSave: (draft: LeaveDraft) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [date, setDate] = useState<string | null>(initial.date)
  const [type, setType] = useState<LeaveType>('full')
  const [customAmount, setCustomAmount] = useState<number | string>(0.75)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!opened) return
    setDate(initial.date)
    if ('amount' in initial) {
      setType(initial.type)
      if (initial.type === 'custom') setCustomAmount(initial.amount)
    } else {
      setType('full')
      setCustomAmount(0.75)
    }
  }, [opened]) // eslint-disable-line react-hooks/exhaustive-deps

  const amount = type === 'custom' ? Number(customAmount) : TYPE_AMOUNT[type]
  const valid = !!date && isValidAmount(amount)

  const save = async () => {
    if (!valid || !date) return
    setSaving(true)
    try {
      await onSave({ date, amount, type })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editing ? '연차 수정' : '연차 등록'}
      centered
      radius="lg"
    >
      <Stack>
        <DatePickerInput
          label="날짜"
          value={date}
          onChange={setDate}
          valueFormat="YYYY년 M월 D일 (dd)"
          required
        />
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            사용 시간
          </Text>
          <SegmentedControl
            fullWidth
            value={type}
            onChange={(v) => setType(v as LeaveType)}
            data={[
              { label: '연차 (1)', value: 'full' },
              { label: '반차 (0.5)', value: 'half' },
              { label: '반반차 (0.25)', value: 'quarter' },
              { label: '직접', value: 'custom' },
            ]}
          />
        </Stack>
        {type === 'custom' && (
          <NumberInput
            label="직접 입력 (0 초과 ~ 1 이하, 소수 둘째 자리까지)"
            value={customAmount}
            onChange={setCustomAmount}
            min={0.01}
            max={1}
            step={0.25}
            decimalScale={2}
            error={
              customAmount !== '' && !isValidAmount(Number(customAmount))
                ? '0.01~1.00 사이, 소수 둘째 자리까지 입력하세요'
                : undefined
            }
          />
        )}
        <Group justify="space-between" mt="xs">
          {editing && onDelete ? (
            <Button variant="subtle" color="red" onClick={() => onDelete()}>
              삭제
            </Button>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={onClose}>
              취소
            </Button>
            <Button onClick={save} disabled={!valid} loading={saving}>
              저장
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}
