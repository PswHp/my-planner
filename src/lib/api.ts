export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:expired'))
    throw new ApiError(res.status, (data as { error?: string }).error ?? `요청 실패 (${res.status})`)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: (path: string) => request<{ ok: true }>('DELETE', path),
}

// ---- 타입 ----
export interface User {
  id: string
  email: string
  name: string | null
  picture: string | null
}

export const COLORS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'] as const
export type Color = (typeof COLORS)[number]

export const COLOR_HEX: Record<Color, string> = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  magenta: '#e87ba4',
  green: '#008300',
  violet: '#6250d6',
  red: '#e34948',
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  start_at: string // YYYY-MM-DDTHH:mm
  end_at: string
  all_day: 0 | 1
  color: Color
}

export interface Task {
  id: string
  title: string
  notes: string
  due_date: string | null
  priority: 0 | 1 | 2 | 3
  done: 0 | 1
  completed_at: string | null
  created_at: string
}

export const CATEGORIES = ['work', 'study', 'health', 'personal', 'meeting', 'rest'] as const
export type Category = (typeof CATEGORIES)[number]

/** 카테고리 → 이름/색 (범주형 팔레트를 고정 순서로 배정) */
export const CATEGORY_INFO: Record<Category, { label: string; color: Color }> = {
  work: { label: '업무', color: 'blue' },
  study: { label: '공부', color: 'orange' },
  health: { label: '운동', color: 'aqua' },
  personal: { label: '개인', color: 'yellow' },
  meeting: { label: '미팅', color: 'magenta' },
  rest: { label: '휴식', color: 'green' },
}

export interface TimeBlock {
  id: string
  date: string
  start_min: number
  end_min: number
  title: string
  category: Category
  task_id: string | null
}

export interface Stats {
  completedByDay: { date: string; count: number }[]
  dueTotal: number
  dueDone: number
  openTasks: number
  overdueTasks: number
  blocksByCategory: { category: Category; minutes: number }[]
  blocksByDay: { date: string; minutes: number }[]
  eventCount: number
}
