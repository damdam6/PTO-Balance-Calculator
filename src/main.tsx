import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import './index.css'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { theme } from './theme'
import App from './App'

dayjs.locale('ko')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0 }}>
        <App />
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>,
)
