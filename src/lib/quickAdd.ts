import { useEffect } from 'react'
import { todayStr } from './date'

/**
 * 상단 바 '+ 추가' 공용 상태
 * - 기준 날짜: 캘린더 · 대시보드에서 날짜를 고르고 있으면 그 날짜, 아니면 오늘
 * - 데이터 변경 알림: 상단 바에서 추가하면 지금 보고 있는 페이지가 다시 불러옴
 */
let contextDate: string | null = null

/** 페이지에서 현재 보고 있는 날짜를 알려줌 (페이지를 떠날 때는 null) */
export function useQuickAddDate(date: string | null) {
  useEffect(() => {
    contextDate = date
    return () => {
      contextDate = null
    }
  }, [date])
}

export const quickAddDate = () => contextDate ?? todayStr()

const EVENT = 'dailumi:data-changed'

export const notifyDataChanged = () => window.dispatchEvent(new Event(EVENT))

/** 다른 곳(상단 바 등)에서 데이터가 바뀌면 reload 실행 */
export function useDataChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT, reload)
    return () => window.removeEventListener(EVENT, reload)
  }, [reload])
}
