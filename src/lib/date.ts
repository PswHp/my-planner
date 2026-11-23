import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

/** Date → 'YYYY-MM-DD' (로컬) */
export const toDateStr = (d: Date) => format(d, 'yyyy-MM-dd')

/** Date → 'YYYY-MM-DDTHH:mm' (로컬) */
export const toDateTimeStr = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

/** 'YYYY-MM-DD' → 로컬 자정 Date */
export const parseDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const fmt = (d: Date, pattern: string) => format(d, pattern, { locale: ko })

/** 분 → 'HH:mm' */
export const minToTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** 'HH:mm' → 분 */
export const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** 분 → '1시간 30분' */
export const formatDuration = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h && m) return `${h}시간 ${m}분`
  if (h) return `${h}시간`
  return `${m}분`
}

export const todayStr = () => toDateStr(new Date())
