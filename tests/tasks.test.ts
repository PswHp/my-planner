/** 할 일 API + 반복 할 일 (functions/api/tasks) */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { client, expectStatus } from './helpers.ts'

const c = client('tasks')

async function createTask(body: Record<string, unknown>) {
  const res = await c.post('/api/tasks', { created_at: '2030-05-01T09:00', ...body })
  expectStatus(res, 201)
  return res.body
}

const allTasks = async () => {
  const res = await c.get('/api/tasks')
  expectStatus(res, 200)
  return res.body as any[]
}

describe('할 일', () => {
  test('추가: 기본값', async () => {
    const t = await createTask({ title: '  장보기  ' })
    assert.equal(t.title, '장보기', '앞뒤 공백 제거')
    assert.equal(t.notes, '')
    assert.equal(t.due_date, null)
    assert.equal(t.priority, 0)
    assert.equal(t.done, 0)
    assert.equal(t.completed_at, null)
    assert.equal(t.series_id, null)
    assert.equal(t.created_at, '2030-05-01T09:00')
    assert.equal(t.user_id, 'test-user-tasks')
  })

  test('완료 상태로 추가하면 완료 시각 = 만든 시각', async () => {
    const t = await createTask({ title: '이미 함', done: true })
    assert.equal(t.done, 1)
    assert.equal(t.completed_at, '2030-05-01T09:00')
  })

  test('완료 처리에는 완료 시각이 필요하고, 완료 취소하면 완료 시각을 지움', async () => {
    const t = await createTask({ title: '완료 테스트' })
    expectStatus(await c.patch(`/api/tasks/${t.id}`, { done: true }), 400)

    let res = await c.patch(`/api/tasks/${t.id}`, { done: true, completed_at: '2030-05-02T10:00' })
    expectStatus(res, 200)
    assert.equal(res.body.done, 1)
    assert.equal(res.body.completed_at, '2030-05-02T10:00')

    res = await c.patch(`/api/tasks/${t.id}`, { done: false })
    expectStatus(res, 200)
    assert.equal(res.body.done, 0)
    assert.equal(res.body.completed_at, null)
  })

  test('수정: 만든 시각은 바꿀 수 없음, 나머지는 반영', async () => {
    const t = await createTask({ title: '수정 전' })
    let res = await c.patch(`/api/tasks/${t.id}`, {
      title: '수정 후',
      notes: '메모',
      due_date: '2030-05-10',
      priority: 3,
      created_at: '2099-01-01T00:00',
    })
    expectStatus(res, 200)
    assert.equal(res.body.title, '수정 후')
    assert.equal(res.body.notes, '메모')
    assert.equal(res.body.due_date, '2030-05-10')
    assert.equal(res.body.priority, 3)
    assert.equal(res.body.created_at, '2030-05-01T09:00')

    res = await c.patch(`/api/tasks/${t.id}`, { due_date: null })
    assert.equal(res.body.due_date, null)
  })

  test('잘못된 값은 400, 없는 할 일은 404', async () => {
    for (const body of [
      { title: '' },
      { title: 'x', priority: 4 },
      { title: 'x', due_date: '2030-5-1' },
      { title: 'x', done: 1 },
      { title: 'x', notes: 'a'.repeat(4001) },
      { title: 'x', created_at: undefined },
    ]) {
      expectStatus(await c.post('/api/tasks', { created_at: '2030-05-01T09:00', ...body }), 400)
    }
    expectStatus(await c.patch('/api/tasks/nope', { title: 'x' }), 404)
    expectStatus(await c.del('/api/tasks/nope'), 404)
  })

  test('목록 순서: 안 한 일 먼저 → 마감일 빠른 순(없으면 뒤) → 우선순위 높은 순 → 최근 만든 순', async () => {
    const before = new Set((await allTasks()).map((t) => t.id))
    const ids = {
      doneEarly: (await createTask({ title: 'done', due_date: '2030-01-01', done: true })).id,
      noDue: (await createTask({ title: 'noDue', priority: 3 })).id,
      dueLate: (await createTask({ title: 'dueLate', due_date: '2030-06-02' })).id,
      dueSoonLow: (await createTask({ title: 'dueSoonLow', due_date: '2030-06-01', priority: 1 })).id,
      dueSoonHigh: (await createTask({ title: 'dueSoonHigh', due_date: '2030-06-01', priority: 2 })).id,
      noDueOld: (await createTask({ title: 'noDueOld', priority: 3, created_at: '2030-04-01T09:00' })).id,
    }
    const order = (await allTasks()).filter((t) => !before.has(t.id)).map((t) => t.title)
    assert.deepEqual(order, ['dueSoonHigh', 'dueSoonLow', 'dueLate', 'noDue', 'noDueOld', 'done'])
    for (const id of Object.values(ids)) expectStatus(await c.del(`/api/tasks/${id}`), 200)
  })
})

describe('반복 할 일', () => {
  // 2030-06-03(월) ~ 2030-06-16(일), 월 · 금 → 06-03, 06-07, 06-10, 06-14
  const RANGE = { from: '2030-06-03', until: '2030-06-16', days: [1, 5] }
  const DATES = ['2030-06-03', '2030-06-07', '2030-06-10', '2030-06-14']
  const seriesTasks = async (id: string) =>
    (await allTasks()).filter((t) => t.series_id === id).sort((a, b) => a.due_date.localeCompare(b.due_date))

  test('추가 · 전체 수정 · 전체 삭제', async () => {
    const res = await c.post('/api/tasks/series', {
      ...RANGE,
      title: '분리수거',
      notes: '월금',
      priority: 2,
      created_at: '2030-06-01T08:00',
    })
    expectStatus(res, 201)
    assert.equal(res.body.count, 4)
    assert.equal(res.body.first, DATES[0])
    assert.equal(res.body.last, DATES[3])
    const id = res.body.series_id

    let tasks = await seriesTasks(id)
    assert.deepEqual(
      tasks.map((t) => [t.due_date, t.title, t.notes, t.priority, t.done, t.completed_at, t.created_at]),
      DATES.map((d) => [d, '분리수거', '월금', 2, 0, null, '2030-06-01T08:00']),
    )

    // 하나 완료 · 하나 마감일 변경 뒤 전체 수정 → 마감일 · 완료 상태는 그대로
    expectStatus(await c.patch(`/api/tasks/${tasks[0].id}`, { done: true, completed_at: '2030-06-03T20:00' }), 200)
    expectStatus(await c.patch(`/api/tasks/${tasks[1].id}`, { due_date: '2030-06-08' }), 200)
    const patched = await c.patch(`/api/tasks/series/${id}`, { title: '재활용', priority: 1 })
    expectStatus(patched, 200)
    assert.equal(patched.body.updated, 4)

    tasks = await seriesTasks(id)
    assert.deepEqual(
      tasks.map((t) => [t.due_date, t.title, t.notes, t.priority, t.done]),
      [
        ['2030-06-03', '재활용', '', 1, 1],
        ['2030-06-08', '재활용', '', 1, 0],
        ['2030-06-10', '재활용', '', 1, 0],
        ['2030-06-14', '재활용', '', 1, 0],
      ],
      '메모를 안 보내면 빈 값으로',
    )

    const deleted = await c.del(`/api/tasks/series/${id}`)
    expectStatus(deleted, 200)
    assert.equal(deleted.body.deleted, 4)
    assert.equal((await seriesTasks(id)).length, 0)
    expectStatus(await c.del(`/api/tasks/series/${id}`), 404)
    expectStatus(await c.patch(`/api/tasks/series/${id}`, { title: 'x' }), 404)
  })

  test('반복 할 일을 지우면 연결된 블록은 남고 연결만 풀림', async () => {
    const res = await c.post('/api/tasks/series', { ...RANGE, title: '블록 연결', created_at: '2030-06-01T08:00' })
    const [first] = await seriesTasks(res.body.series_id)
    const block = await c.post('/api/blocks', { date: '2030-06-03', start_min: 600, end_min: 660, title: '블록', task_id: first.id })
    expectStatus(block, 201)
    expectStatus(await c.del(`/api/tasks/series/${res.body.series_id}`), 200)
    const blocks = await c.get('/api/blocks?from=2030-06-03&to=2030-06-03')
    assert.equal(blocks.body.find((b: any) => b.id === block.body.id).task_id, null)
  })

  test('잘못된 값은 400', async () => {
    const ok = { ...RANGE, title: '검증', created_at: '2030-06-01T08:00' }
    for (const body of [
      { ...ok, title: '' },
      { ...ok, created_at: undefined },
      { ...ok, days: [] },
      { ...ok, priority: 9 },
    ]) {
      expectStatus(await c.post('/api/tasks/series', body), 400)
    }
  })
})
