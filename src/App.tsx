import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Affix,
  Alert,
  Button,
  Center,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Title,
} from '@mantine/core'
import dayjs from 'dayjs'
import { api, ApiError, type ApiLeave } from './api'
import { evaluate, type Leave, type Settings } from '../shared/balance'
import Login from './views/Login'
import CalendarView from './views/CalendarView'
import ListView from './views/ListView'
import SettingsDrawer from './views/Settings'
import SummaryBar from './components/SummaryBar'
import LeaveModal, { type LeaveDraft } from './components/LeaveModal'

type AuthState = 'loading' | 'anon' | 'authed'

export default function App() {
  const [auth, setAuth] = useState<AuthState>('loading')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const today = dayjs().format('YYYY-MM-DD')
  const [selectedDate, setSelectedDate] = useState(today)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modalState, setModalState] = useState<
    { mode: 'closed' } | { mode: 'create'; date: string } | { mode: 'edit'; leave: Leave }
  >({ mode: 'closed' })

  const loadData = useCallback(async () => {
    const [s, l] = await Promise.all([api.getSettings(), api.listLeaves()])
    setSettings(s.settings)
    setLeaves(l.leaves as ApiLeave[])
    setAuth('authed')
    if (!s.settings) setSettingsOpen(true)
  }, [])

  useEffect(() => {
    api
      .me()
      .then(loadData)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setAuth('anon')
        else setAuth('anon')
      })
  }, [loadData])

  const evaluated = useMemo(
    () => (settings ? evaluate(settings, leaves) : []),
    [settings, leaves],
  )

  const saveLeave = async (draft: LeaveDraft) => {
    if (modalState.mode === 'edit') {
      await api.updateLeave(modalState.leave.id, draft)
    } else {
      await api.createLeave(draft)
    }
    const l = await api.listLeaves()
    setLeaves(l.leaves)
  }

  const deleteLeave = async () => {
    if (modalState.mode !== 'edit') return
    await api.deleteLeave(modalState.leave.id)
    const l = await api.listLeaves()
    setLeaves(l.leaves)
    setModalState({ mode: 'closed' })
  }

  const logout = async () => {
    await api.logout()
    setAuth('anon')
    setSettings(null)
    setLeaves([])
    setSettingsOpen(false)
  }

  if (auth === 'loading') {
    return (
      <Center style={{ minHeight: '100dvh' }}>
        <Loader />
      </Center>
    )
  }

  if (auth === 'anon') return <Login onLogin={loadData} />

  return (
    <Stack p="md" gap="md" pb={90}>
      <Group justify="space-between">
        <Title order={3}>연차 계산기</Title>
        <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setSettingsOpen(true)} aria-label="설정">
          {/* gear icon (inline svg, 의존성 없이) */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </ActionIcon>
      </Group>

      {settings ? (
        <>
          <SummaryBar
            settings={settings}
            leaves={leaves}
            selectedDate={selectedDate}
            today={today}
          />
          <SegmentedControl
            fullWidth
            value={view}
            onChange={(v) => setView(v as 'calendar' | 'list')}
            data={[
              { label: '캘린더', value: 'calendar' },
              { label: '리스트', value: 'list' },
            ]}
          />
          {view === 'calendar' ? (
            <CalendarView
              settings={settings}
              evaluated={evaluated}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                if (date === selectedDate) {
                  // 같은 날짜 재탭 → 그 날짜 건 수정 또는 새 등록
                  const existing = leaves.find((l) => l.date === date)
                  setModalState(
                    existing ? { mode: 'edit', leave: existing } : { mode: 'create', date },
                  )
                } else {
                  setSelectedDate(date)
                }
              }}
            />
          ) : (
            <ListView
              evaluated={evaluated}
              today={today}
              onSelect={(l) =>
                setModalState({
                  mode: 'edit',
                  leave: { id: l.id, date: l.date, amount: l.amount, type: l.type },
                })
              }
            />
          )}
        </>
      ) : (
        <Alert color="yellow" title="설정이 필요합니다">
          연차 발생일과 기준 잔여 연차를 먼저 설정해주세요.
          <Button mt="sm" size="xs" onClick={() => setSettingsOpen(true)}>
            설정 열기
          </Button>
        </Alert>
      )}

      {settings && (
        <Affix position={{ bottom: 24, right: 'max(24px, calc(50vw - 191px))' }}>
          <ActionIcon
            size={56}
            radius={28}
            variant="filled"
            aria-label="연차 등록"
            onClick={() => setModalState({ mode: 'create', date: selectedDate })}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </ActionIcon>
        </Affix>
      )}

      <SettingsDrawer
        key={`${settingsOpen}-${settings?.baseDate ?? 'none'}`}
        opened={settingsOpen}
        current={settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => setSettings(s)}
        onLogout={logout}
      />

      <LeaveModal
        opened={modalState.mode !== 'closed'}
        editing={modalState.mode === 'edit'}
        initial={
          modalState.mode === 'edit'
            ? modalState.leave
            : { date: modalState.mode === 'create' ? modalState.date : selectedDate }
        }
        onClose={() => setModalState({ mode: 'closed' })}
        onSave={saveLeave}
        onDelete={deleteLeave}
      />
    </Stack>
  )
}
