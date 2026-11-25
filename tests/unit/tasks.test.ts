/** 화면의 할 일 고르기 (src/lib/tasks.ts — 대시보드 · 캘린더 공용) */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Task } from '../../src/lib/api.ts'
import { tasksDueOn, undatedOpenTasks } from '../../src/lib/tasks.ts'

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  notes: '',
  due_date: null,
  priority: 0,
  done: 0,
  completed_at: null,
  created_at: '2030-01-01T09:00',
  ...over,
})

const tasks = [
  task('doneHigh', { due_date: '2030-01-05', done: 1, priority: 3 }),
  task('low', { due_date: '2030-01-05', priority: 1 }),
  task('high', { due_date: '2030-01-05', priority: 3 }),
  task('none', { due_date: '2030-01-05' }),
  task('overdue', { due_date: '2030-01-04', priority: 3 }),
  task('later', { due_date: '2030-01-06' }),
  task('undatedLow', { priority: 1 }),
  task('undatedHigh', { priority: 2 }),
  task('undatedDone', { priority: 3, done: 1 }),
]
const ids = (list: Task[]) => list.map((t) => t.id)

test('그날 마감인 할 일만: 안 한 일 먼저, 같으면 우선순위 높은 순 (기한 지난 일 · 다른 날 · 기한 없음 제외)', () => {
  assert.deepEqual(ids(tasksDueOn(tasks, '2030-01-05')), ['high', 'low', 'none', 'doneHigh'])
  assert.deepEqual(ids(tasksDueOn(tasks, '2030-01-07')), [])
})

test('기한 없는 미완료 할 일: 우선순위 높은 순, 완료한 일 제외', () => {
  assert.deepEqual(ids(undatedOpenTasks(tasks)), ['undatedHigh', 'undatedLow'])
})

test('원래 배열은 바꾸지 않음', () => {
  const before = ids(tasks)
  tasksDueOn(tasks, '2030-01-05')
  undatedOpenTasks(tasks)
  assert.deepEqual(ids(tasks), before)
})
