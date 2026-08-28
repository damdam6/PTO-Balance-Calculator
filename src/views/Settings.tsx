import { useState } from 'react'
import { Alert, Button, Drawer, NumberInput, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import type { Settings } from '../../shared/balance'
import { api } from '../api'

export default function SettingsDrawer({
  opened,
  current,
  onClose,
  onSaved,
  onLogout,
}: {
  opened: boolean
  current: Settings | null
  onClose: () => void
  onSaved: (s: Settings) => void
  onLogout: () => void
}) {
  const [accrualDay, setAccrualDay] = useState<number | string>(current?.accrualDay ?? 1)
  const [baseDate, setBaseDate] = useState<string | null>(current?.baseDate ?? null)
  const [baseBalance, setBaseBalance] = useState<number | string>(current?.baseBalance ?? 0)
  const [saving, setSaving] = useState(false)

  const valid =
    Number.isInteger(Number(accrualDay)) &&
    Number(accrualDay) >= 1 &&
    Number(accrualDay) <= 31 &&
    !!baseDate &&
    Number.isFinite(Number(baseBalance))

  const save = async () => {
    if (!valid || !baseDate) return
    setSaving(true)
    try {
      const s: Settings = {
        accrualDay: Number(accrualDay),
        baseDate,
        baseBalance: Math.round(Number(baseBalance) * 100) / 100,
      }
      await api.putSettings(s)
      onSaved(s)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer opened={opened} onClose={onClose} title="설정" position="bottom" radius="lg">
      <Stack>
        <NumberInput
          label="매달 연차 발생일"
          description="매달 이 날짜에 연차가 1개씩 생깁니다. 없는 달은 말일에 발생합니다."
          value={accrualDay}
          onChange={setAccrualDay}
          min={1}
          max={31}
          allowDecimal={false}
        />
        <DatePickerInput
          label="기준일"
          description="이 날짜 시점의 잔여 연차를 입력하면 이후부터 자동 계산됩니다."
          value={baseDate}
          onChange={setBaseDate}
          valueFormat="YYYY년 M월 D일"
        />
        <NumberInput
          label="기준일 잔여 연차"
          value={baseBalance}
          onChange={setBaseBalance}
          decimalScale={2}
          step={0.25}
        />
        <Alert color="gray" p="xs">
          <Text size="xs">기준일 이전의 연차 건은 계산에 반영되지 않습니다.</Text>
        </Alert>
        <Button onClick={save} disabled={!valid} loading={saving} fullWidth>
          저장
        </Button>
        <Button variant="subtle" color="gray" onClick={onLogout} fullWidth>
          로그아웃
        </Button>
      </Stack>
    </Drawer>
  )
}
