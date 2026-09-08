import { useState } from 'react'
import {
  Alert,
  Button,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { api, ApiError } from '../api'

const SIGNUP_ERROR_MESSAGES: Record<string, string> = {
  invalid_username: '아이디는 영문/숫자/-/_ 3~20자로 입력하세요.',
  weak_password: '비밀번호는 8자 이상이어야 합니다.',
  invalid_code: '가입 코드가 올바르지 않습니다.',
  username_taken: '이미 사용 중인 아이디입니다.',
}

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'signup' && password !== passwordConfirm) {
      setError('비밀번호가 서로 일치하지 않습니다.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await api.login(username, password)
      } else {
        await api.signup(username, password, code)
      }
      onLogin()
    } catch (err) {
      if (mode === 'login') {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      } else {
        const key = err instanceof ApiError ? err.message : ''
        setError(SIGNUP_ERROR_MESSAGES[key] ?? '회원가입에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack justify="center" style={{ minHeight: '100dvh' }} p="lg">
      <Stack gap={4} align="center" mb="md">
        <Title order={2}>연차 계산기</Title>
        <Text c="dimmed" size="sm">
          1년 미만 월 단위 발생 연차 관리
        </Text>
      </Stack>
      <Paper withBorder p="lg" radius="lg">
        <Stack>
          <SegmentedControl
            fullWidth
            value={mode}
            onChange={(v) => {
              setMode(v as 'login' | 'signup')
              setError(null)
            }}
            data={[
              { label: '로그인', value: 'login' },
              { label: '회원가입', value: 'signup' },
            ]}
          />
          <form onSubmit={submit}>
            <Stack>
              <TextInput
                label="아이디"
                description={mode === 'signup' ? '영문/숫자/-/_ 3~20자' : undefined}
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                autoComplete="username"
                required
              />
              <PasswordInput
                label="비밀번호"
                description={mode === 'signup' ? '8자 이상' : undefined}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              {mode === 'signup' && (
                <>
                  <PasswordInput
                    label="비밀번호 확인"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.currentTarget.value)}
                    autoComplete="new-password"
                    required
                    error={
                      passwordConfirm !== '' && passwordConfirm !== password
                        ? '비밀번호가 일치하지 않습니다'
                        : undefined
                    }
                  />
                  <TextInput
                    label="가입 코드"
                    description="운영자가 가입 코드를 설정한 경우에만 입력"
                    value={code}
                    onChange={(e) => setCode(e.currentTarget.value)}
                  />
                </>
              )}
              {error && (
                <Alert color="red" p="xs">
                  {error}
                </Alert>
              )}
              <Button type="submit" loading={loading} fullWidth>
                {mode === 'login' ? '로그인' : '가입하기'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Stack>
  )
}
