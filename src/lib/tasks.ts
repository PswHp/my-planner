import type { Task } from './api'

/** 그날이 마감인 할 일 — 안 한 일 먼저, 같으면 우선순위 높은 순 (기한이 지난 할 일은 넣지 않음) */
export const tasksDueOn = (tasks: Task[], date: string) =>
  tasks.filter((t) => t.due_date === date).sort((a, b) => a.done - b.done || b.priority - a.priority)

/** 기한 없는 미완료 할 일 — 우선순위 높은 순 */
export const undatedOpenTasks = (tasks: Task[]) => tasks.filter((t) => !t.due_date && !t.done).sort((a, b) => b.priority - a.priority)
