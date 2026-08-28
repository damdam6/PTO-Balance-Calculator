import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', sans-serif",
})

/** 상태색: 초록(사용 가능) / 빨강(불가) — 연차 건 평가 결과에만 사용 */
export const STATUS_COLORS = {
  ok: 'teal',
  insufficient: 'red',
  beforeBase: 'gray',
} as const
