/** 일정 API + 일정 → 타임 블록 연결 (functions/_lib/link.ts syncBlockForEvent) */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { blocksOn, client, eventsOn, expectStatus } from './helpers.ts'

const c = client('events')

async function createEvent(body: Record<string, unknown>) {
  const res = await c.post('/api/events', body)
  expectStatus(res, 201)
  return res.body
}

const linkedBlock = async (eventId: string, date: string) => (await blocksOn(c, date)).find((b) => b.event_id === eventId)

describe('일정 추가', () => {
  test('하루 안의 시간 일정 → 같은 시간의 블록이 함께 생기고 색으로 카테고리를 정함', async () => {
    const ev = await createEvent({ title: '영어 공부', start_at: '2030-01-07T09:30', end_at: '2030-01-07T11:00', color: 'orange' })
    assert.equal(ev.block_category, 'study')
    const b = await linkedBlock(ev.id, '2030-01-07')
    assert.ok(b, '연결된 블록이 있어야 함')
    assert.equal(b.title, '영어 공부')
    assert.equal(b.start_min, 570)
    assert.equal(b.end_min, 660)
    assert.equal(b.category, 'study')
    assert.equal(b.series_id, null)
    assert.equal(b.task_id, null)
  })

  test('카테고리를 직접 고르면 블록은 그 카테고리, 일정 색은 그대로', async () => {
    const ev = await createEvent({
      title: '산책',
      start_at: '2030-01-08T18:00',
      end_at: '2030-01-08T19:00',
      color: 'blue',
      category: 'health',
    })
    assert.equal(ev.color, 'blue')
    assert.equal(ev.block_category, 'health')
    assert.equal((await linkedBlock(ev.id, '2030-01-08'))?.category, 'health')
  })

  test('색을 안 보내면 기본 색(blue) → 블록 카테고리 work', async () => {
    const ev = await createEvent({ title: '회의 준비', start_at: '2030-01-09T10:00', end_at: '2030-01-09T10:30' })
    assert.equal(ev.color, 'blue')
    assert.equal(ev.block_category, 'work')
  })

  test('23:59 에 끝나는 일정 → 블록 끝은 1439분', async () => {
    const ev = await createEvent({ title: '밤 작업', start_at: '2030-01-10T22:00', end_at: '2030-01-10T23:59', color: 'violet' })
    const b = await linkedBlock(ev.id, '2030-01-10')
    assert.equal(b.end_min, 1439)
    assert.equal(b.category, 'personal', '카테고리에 없는 색은 personal')
  })

  test('종일 · 여러 날 · 길이 0 일정은 블록을 만들지 않음', async () => {
    const allDay = await createEvent({ title: '휴가', start_at: '2030-01-11T00:00', end_at: '2030-01-11T23:59', all_day: true })
    const multi = await createEvent({ title: '여행', start_at: '2030-01-12T10:00', end_at: '2030-01-13T10:00' })
    const zero = await createEvent({ title: '알림', start_at: '2030-01-14T10:00', end_at: '2030-01-14T10:00' })
    for (const ev of [allDay, multi, zero]) assert.equal(ev.block_category, null)
    assert.equal((await blocksOn(c, '2030-01-11', '2030-01-14')).length, 0)
  })

  test('목록(GET)에 연결된 블록의 카테고리가 함께 옴', async () => {
    const ev = await createEvent({ title: '목록 확인', start_at: '2030-01-15T08:00', end_at: '2030-01-15T09:00', category: 'rest' })
    const allDay = await createEvent({ title: '목록 종일', start_at: '2030-01-15T00:00', end_at: '2030-01-15T23:59', all_day: true })
    const list = await eventsOn(c, '2030-01-15')
    assert.equal(list.find((e) => e.id === ev.id)?.block_category, 'rest')
    assert.equal(list.find((e) => e.id === allDay.id)?.block_category, null)
  })

  test('기간과 겹치는 일정만 가져옴 (여러 날 일정 포함)', async () => {
    const ev = await createEvent({ title: '긴 일정', start_at: '2030-02-01T10:00', end_at: '2030-02-05T10:00' })
    assert.ok((await eventsOn(c, '2030-02-03')).some((e) => e.id === ev.id))
    assert.ok(!(await eventsOn(c, '2030-02-06')).some((e) => e.id === ev.id))
    assert.ok(!(await eventsOn(c, '2030-01-31')).some((e) => e.id === ev.id))
  })

  test('잘못된 값은 400', async () => {
    const base = { title: '검증', start_at: '2030-01-16T10:00', end_at: '2030-01-16T11:00' }
    for (const body of [
      { ...base, title: '   ' },
      { ...base, start_at: '2030-01-16 10:00' },
      { ...base, end_at: '2030-01-16T09:00' },
      { ...base, color: 'pink' },
      { ...base, category: 'sleep' },
      { ...base, all_day: 'yes' },
      { start_at: base.start_at, end_at: base.end_at },
    ]) {
      expectStatus(await c.post('/api/events', body), 400)
    }
    expectStatus(await c.get('/api/events?from=2030-01-01'), 400)
    assert.equal((await blocksOn(c, '2030-01-16')).length, 0)
  })
})

describe('일정 수정 → 연결된 블록도 맞춤', () => {
  test('제목 · 시간 · 날짜를 바꾸면 블록도 따라감', async () => {
    const ev = await createEvent({ title: '원래', start_at: '2030-03-04T09:00', end_at: '2030-03-04T10:00', color: 'magenta' })
    const before = await linkedBlock(ev.id, '2030-03-04')

    const res = await c.patch(`/api/events/${ev.id}`, { title: '바뀜', start_at: '2030-03-05T13:15', end_at: '2030-03-05T14:45' })
    expectStatus(res, 200)
    assert.equal(res.body.title, '바뀜')

    assert.equal(await linkedBlock(ev.id, '2030-03-04'), undefined)
    const after = await linkedBlock(ev.id, '2030-03-05')
    assert.equal(after.id, before.id, '블록을 새로 만들지 않고 그대로 수정')
    assert.equal(after.title, '바뀜')
    assert.equal(after.start_min, 795)
    assert.equal(after.end_min, 885)
    assert.equal(after.category, 'meeting', '카테고리는 유지')
  })

  test('카테고리만 바꾸면 블록 카테고리만 바뀌고 일정 색은 그대로', async () => {
    const ev = await createEvent({ title: '카테고리', start_at: '2030-03-06T09:00', end_at: '2030-03-06T10:00', color: 'green' })
    // 현재 동작: 일정 필드 없이 category 만 보내면 '변경할 항목이 없습니다' (화면은 항상 제목 · 시간과 함께 보냄)
    expectStatus(await c.patch(`/api/events/${ev.id}`, { category: 'work' }), 400)
    const res = await c.patch(`/api/events/${ev.id}`, { title: '카테고리', category: 'work' })
    expectStatus(res, 200)
    assert.equal(res.body.color, 'green')
    assert.equal((await linkedBlock(ev.id, '2030-03-06')).category, 'work')
  })

  test('색만 바꾸면 기존 블록 카테고리는 유지', async () => {
    const ev = await createEvent({ title: '색', start_at: '2030-03-07T09:00', end_at: '2030-03-07T10:00', color: 'green' })
    expectStatus(await c.patch(`/api/events/${ev.id}`, { color: 'blue' }), 200)
    assert.equal((await linkedBlock(ev.id, '2030-03-07')).category, 'rest')
  })

  test('종일로 바꾸면 블록 삭제, 다시 시간 일정으로 바꾸면 블록을 새로 만듦', async () => {
    const ev = await createEvent({ title: '전환', start_at: '2030-03-08T09:00', end_at: '2030-03-08T10:00', color: 'aqua' })
    expectStatus(await c.patch(`/api/events/${ev.id}`, { all_day: true }), 200)
    assert.equal((await blocksOn(c, '2030-03-08')).length, 0)

    expectStatus(await c.patch(`/api/events/${ev.id}`, { all_day: false, start_at: '2030-03-08T15:00', end_at: '2030-03-08T16:00' }), 200)
    const b = await linkedBlock(ev.id, '2030-03-08')
    assert.equal(b.start_min, 900)
    assert.equal(b.category, 'health', '새 블록은 일정 색으로 카테고리를 정함')
  })

  test('여러 날로 늘리면 블록 삭제', async () => {
    const ev = await createEvent({ title: '늘림', start_at: '2030-03-09T09:00', end_at: '2030-03-09T10:00' })
    expectStatus(await c.patch(`/api/events/${ev.id}`, { end_at: '2030-03-10T10:00' }), 200)
    assert.equal((await blocksOn(c, '2030-03-09', '2030-03-10')).length, 0)
  })

  test('종료가 시작보다 앞서게 바꾸면 400, 일정 · 블록은 그대로', async () => {
    const ev = await createEvent({ title: '순서', start_at: '2030-03-11T09:00', end_at: '2030-03-11T10:00' })
    expectStatus(await c.patch(`/api/events/${ev.id}`, { end_at: '2030-03-11T08:00' }), 400)
    expectStatus(await c.patch(`/api/events/${ev.id}`, {}), 400)
    assert.equal((await linkedBlock(ev.id, '2030-03-11')).end_min, 600)
  })

  test('없는 일정 수정 · 삭제는 404', async () => {
    expectStatus(await c.patch('/api/events/nope', { title: 'x' }), 404)
    expectStatus(await c.del('/api/events/nope'), 404)
  })
})

describe('일정 삭제', () => {
  test('일정을 지우면 연결된 블록도 지워짐', async () => {
    const ev = await createEvent({ title: '삭제', start_at: '2030-03-12T09:00', end_at: '2030-03-12T10:00' })
    assert.ok(await linkedBlock(ev.id, '2030-03-12'))
    expectStatus(await c.del(`/api/events/${ev.id}`), 200)
    assert.equal((await blocksOn(c, '2030-03-12')).length, 0)
    assert.equal((await eventsOn(c, '2030-03-12')).length, 0)
    expectStatus(await c.del(`/api/events/${ev.id}`), 404)
  })
})
