/** 타임 블록 API + 블록 → 일정 연결 (functions/api/blocks) */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { blocksOn, client, eventsOn, expectStatus } from './helpers.ts'

const c = client('blocks')

async function createBlock(body: Record<string, unknown>) {
  const res = await c.post('/api/blocks', body)
  expectStatus(res, 201)
  return res.body
}

const eventById = async (id: string, date: string) => (await eventsOn(c, date)).find((e) => e.id === id)

describe('블록 추가', () => {
  test('블록을 만들면 같은 시간의 일정이 함께 생기고 카테고리 색을 씀', async () => {
    const b = await createBlock({ date: '2031-01-06', start_min: 540, end_min: 615, title: '팀 회의', category: 'meeting' })
    assert.ok(b.event_id, '일정과 연결돼야 함')
    assert.equal(b.category, 'meeting')
    const ev = await eventById(b.event_id, '2031-01-06')
    assert.equal(ev.title, '팀 회의')
    assert.equal(ev.start_at, '2031-01-06T09:00')
    assert.equal(ev.end_at, '2031-01-06T10:15')
    assert.equal(ev.all_day, 0)
    assert.equal(ev.color, 'magenta')
    assert.equal(ev.description, '')
    assert.equal(ev.block_category, 'meeting')
  })

  test('카테고리를 안 보내면 work(파랑)', async () => {
    const b = await createBlock({ date: '2031-01-07', start_min: 60, end_min: 120, title: '기본' })
    assert.equal(b.category, 'work')
    assert.equal((await eventById(b.event_id, '2031-01-07')).color, 'blue')
  })

  test('자정(1440분)에 끝나는 블록 → 일정은 23:59 에 끝남', async () => {
    const b = await createBlock({ date: '2031-01-08', start_min: 1380, end_min: 1440, title: '마무리', category: 'rest' })
    const ev = await eventById(b.event_id, '2031-01-08')
    assert.equal(ev.end_at, '2031-01-08T23:59')
    assert.equal(ev.color, 'green')
  })

  test('할 일과 연결: 내 할 일이면 OK, 없는 할 일이면 404', async () => {
    const task = await c.post('/api/tasks', { title: '블록용 할 일', created_at: '2031-01-01T09:00' })
    expectStatus(task, 201)
    const b = await createBlock({ date: '2031-01-09', start_min: 600, end_min: 660, title: '할 일 블록', task_id: task.body.id })
    assert.equal(b.task_id, task.body.id)
    expectStatus(await c.post('/api/blocks', { date: '2031-01-09', start_min: 700, end_min: 760, title: 'x', task_id: 'nope' }), 404)

    // 할 일을 지우면 블록은 남고 연결만 풀림
    expectStatus(await c.del(`/api/tasks/${task.body.id}`), 200)
    const after = (await blocksOn(c, '2031-01-09')).find((x) => x.id === b.id)
    assert.equal(after.task_id, null)
  })

  test('잘못된 값은 400, 일정도 만들어지지 않음', async () => {
    const base = { date: '2031-01-10', start_min: 600, end_min: 660, title: '검증' }
    for (const body of [
      { ...base, end_min: 600 },
      { ...base, end_min: 1441 },
      { ...base, start_min: -1 },
      { ...base, start_min: 10.5 },
      { ...base, date: '2031/01/10' },
      { ...base, category: 'sleep' },
      { ...base, title: '' },
      { date: base.date, start_min: 600, end_min: 660 },
    ]) {
      expectStatus(await c.post('/api/blocks', body), 400)
    }
    assert.equal((await blocksOn(c, '2031-01-10')).length, 0)
    assert.equal((await eventsOn(c, '2031-01-10')).length, 0)
  })

  test('목록은 날짜 · 시작 시각 순', async () => {
    await createBlock({ date: '2031-01-12', start_min: 600, end_min: 660, title: 'B' })
    await createBlock({ date: '2031-01-11', start_min: 700, end_min: 760, title: 'A2' })
    await createBlock({ date: '2031-01-11', start_min: 100, end_min: 160, title: 'A1' })
    assert.deepEqual(
      (await blocksOn(c, '2031-01-11', '2031-01-12')).map((b) => b.title),
      ['A1', 'A2', 'B'],
    )
    expectStatus(await c.get('/api/blocks?from=2031-01-11'), 400)
  })
})

describe('블록 수정 → 연결된 일정도 맞춤', () => {
  test('제목 · 날짜 · 시간을 바꾸면 일정도 따라감', async () => {
    const b = await createBlock({ date: '2031-02-03', start_min: 540, end_min: 600, title: '원래', category: 'study' })
    const res = await c.patch(`/api/blocks/${b.id}`, { title: '바뀜', date: '2031-02-04', start_min: 780, end_min: 870 })
    expectStatus(res, 200)
    assert.equal(res.body.event_id, b.event_id)
    const ev = await eventById(b.event_id, '2031-02-04')
    assert.equal(ev.title, '바뀜')
    assert.equal(ev.start_at, '2031-02-04T13:00')
    assert.equal(ev.end_at, '2031-02-04T14:30')
    assert.equal(ev.color, 'orange', '카테고리를 안 바꾸면 색 유지')
  })

  test('카테고리를 바꿀 때만 일정 색을 바꾸고, 직접 고른 일정 색은 유지', async () => {
    const b = await createBlock({ date: '2031-02-05', start_min: 540, end_min: 600, title: '색', category: 'study' })
    expectStatus(await c.patch(`/api/blocks/${b.id}`, { category: 'health' }), 200)
    assert.equal((await eventById(b.event_id, '2031-02-05')).color, 'aqua')

    // 일정에서 색을 직접 바꾼 뒤
    expectStatus(await c.patch(`/api/events/${b.event_id}`, { color: 'violet' }), 200)
    // 블록의 제목만 바꾸거나 같은 카테고리를 다시 보내면 색 유지
    expectStatus(await c.patch(`/api/blocks/${b.id}`, { title: '색2', category: 'health' }), 200)
    const ev = await eventById(b.event_id, '2031-02-05')
    assert.equal(ev.color, 'violet')
    assert.equal(ev.title, '색2')
  })

  test('연결된 일정을 종일로 바꾸면 블록이 지워져서 블록 수정은 404', async () => {
    const b = await createBlock({ date: '2031-02-06', start_min: 540, end_min: 600, title: '종일 전환' })
    expectStatus(await c.patch(`/api/events/${b.event_id}`, { all_day: true }), 200)
    assert.equal((await blocksOn(c, '2031-02-06')).length, 0)
    expectStatus(await c.patch(`/api/blocks/${b.id}`, { title: 'x' }), 404)
  })

  test('연결 기능 이전의 블록을 고치면 일정을 새로 만들어 연결 (두 번째부터는 그 일정을 수정)', async () => {
    const legacy = (await blocksOn(c, '2031-03-10')).find((b) => b.id === 'legacy-block')
    assert.ok(legacy, 'setup.ts 가 넣어 둔 예전 블록')
    assert.equal(legacy.event_id, null)
    assert.equal((await eventsOn(c, '2031-03-10')).length, 0)

    const res = await c.patch('/api/blocks/legacy-block', { title: '예전 블록 수정' })
    expectStatus(res, 200)
    assert.ok(res.body.event_id)
    let events = await eventsOn(c, '2031-03-10')
    assert.equal(events.length, 1)
    assert.equal(events[0].id, res.body.event_id)
    assert.equal(events[0].title, '예전 블록 수정')
    assert.equal(events[0].start_at, '2031-03-10T10:00')
    assert.equal(events[0].color, 'orange')

    expectStatus(await c.patch('/api/blocks/legacy-block', { end_min: 690 }), 200)
    events = await eventsOn(c, '2031-03-10')
    assert.equal(events.length, 1, '일정을 또 만들지 않음')
    assert.equal(events[0].end_at, '2031-03-10T11:30')
  })

  test('잘못된 수정은 400 / 404', async () => {
    const b = await createBlock({ date: '2031-02-07', start_min: 540, end_min: 600, title: '검증' })
    expectStatus(await c.patch(`/api/blocks/${b.id}`, { end_min: 500 }), 400)
    expectStatus(await c.patch(`/api/blocks/${b.id}`, { start_min: 600 }), 400)
    expectStatus(await c.patch(`/api/blocks/${b.id}`, { task_id: 'nope' }), 404)
    expectStatus(await c.patch('/api/blocks/nope', { title: 'x' }), 404)
    assert.equal((await eventById(b.event_id, '2031-02-07')).end_at, '2031-02-07T10:00')
  })
})

describe('블록 삭제', () => {
  test('블록을 지우면 연결된 일정도 지워짐', async () => {
    const b = await createBlock({ date: '2031-02-10', start_min: 540, end_min: 600, title: '삭제' })
    expectStatus(await c.del(`/api/blocks/${b.id}`), 200)
    assert.equal((await blocksOn(c, '2031-02-10')).length, 0)
    assert.equal((await eventsOn(c, '2031-02-10')).length, 0)
    expectStatus(await c.del(`/api/blocks/${b.id}`), 404)
  })

  test('일정을 지우면 연결된 블록도 지워짐', async () => {
    const b = await createBlock({ date: '2031-02-11', start_min: 540, end_min: 600, title: '일정 쪽 삭제' })
    expectStatus(await c.del(`/api/events/${b.event_id}`), 200)
    assert.equal((await blocksOn(c, '2031-02-11')).length, 0)
  })
})
