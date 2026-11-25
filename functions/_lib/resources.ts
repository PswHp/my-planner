import { HttpError } from './http'
import { f, type Resource } from './crud'

export const COLORS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'] as const
export const CATEGORIES = ['work', 'study', 'health', 'personal', 'meeting', 'rest'] as const

export const eventResource: Resource = {
  table: 'events',
  fields: {
    title: f.text(200, true),
    description: f.text(2000),
    start_at: f.datetime(),
    end_at: f.datetime(),
    all_day: f.bool(),
    color: f.oneOf(COLORS),
  },
  required: ['title', 'start_at', 'end_at'],
  maxRows: 10_000,
}

export const taskResource: Resource = {
  table: 'tasks',
  fields: {
    title: f.text(300, true),
    notes: f.text(4000),
    due_date: f.date(true),
    priority: f.int(0, 3),
    done: f.bool(),
    completed_at: f.datetime(true),
    created_at: f.datetime(),
  },
  required: ['title', 'created_at'],
  maxRows: 10_000,
}

export const blockResource: Resource = {
  table: 'time_blocks',
  fields: {
    date: f.date(),
    start_min: f.int(0, 1440),
    end_min: f.int(0, 1440),
    title: f.text(200, true),
    category: f.oneOf(CATEGORIES),
    task_id: f.nullableId(),
  },
  required: ['date', 'start_min', 'end_min', 'title'],
  maxRows: 20_000,
}

/** 반복 블록의 공통 내용 (날짜 제외) — POST/PATCH /api/blocks/series */
export const blockSeriesResource: Resource = {
  ...blockResource,
  fields: Object.fromEntries(Object.entries(blockResource.fields).filter(([k]) => k !== 'date')),
  required: ['start_min', 'end_min', 'title'],
}

/** 반복 할 일의 공통 내용 (마감일 · 완료 상태 제외) — POST/PATCH /api/tasks/series */
export const taskSeriesResource: Resource = {
  ...taskResource,
  fields: { title: taskResource.fields.title, notes: taskResource.fields.notes, priority: taskResource.fields.priority },
  required: ['title'],
}

/** 시작/종료 값(문자열 또는 분)이 올바른 순서인지 확인 */
export function assertRange(start: unknown, end: unknown) {
  const ok =
    (typeof start === 'string' && typeof end === 'string' && end >= start) ||
    (typeof start === 'number' && typeof end === 'number' && end > start)
  if (!ok) throw new HttpError(400, '종료 시각은 시작 시각보다 뒤여야 합니다.')
}
