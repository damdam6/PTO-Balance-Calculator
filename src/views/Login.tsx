import { useState } from 'react'
import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { api } from '../api'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.login(username, password)
      onLogin()
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
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
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label="아이디"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              autoComplete="username"
              required
            />
            <PasswordInput
              label="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
              required
            />
            {error && (
              <Alert color="red" p="xs">
                {error}
              </Alert>
            )}
            <Button type="submit" loading={loading} fullWidth>
              로그인
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  )
}
