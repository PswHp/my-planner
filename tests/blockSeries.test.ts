/** 반복 블록 API + 반복 블록 ↔ 일정 일괄 연결 (functions/api/blocks/series, link.ts) */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { blocksOn, client, eventsOn, expectStatus } from './helpers.ts'

const c = client('blockSeries')

// 2033-05-01(일) ~ 2033-05-14(토), 화 · 목 → 4개
const RANGE = { from: '2033-05-01', until: '2033-05-14', days: [2, 4] }
const DATES = ['2033-05-03', '2033-05-05', '2033-05-10', '2033-05-12']

async function createSeries(body: Record<string, unknown>) {
  const res = await c.post('/api/blocks/series', { ...RANGE, ...body })
  expectStatus(res, 201)
  return res.body as { series_id: string; count: number; first: string; last: string }
}

const seriesBlocks = async (id: string) => (await blocksOn(c, RANGE.from, RANGE.until)).filter((b) => b.series_id === id)
const seriesEvents = async (id: string) => (await eventsOn(c, RANGE.from, RANGE.until)).filter((e) => e.series_id === id)

describe('반복 블록', () => {
  test('추가: 요일마다 블록 + 연결된 일정 생성', async () => {
    const s = await createSeries({ title: '운동', category: 'health', start_min: 1140, end_min: 1200 })
    assert.equal(s.count, 4)
    assert.equal(s.first, DATES[0])
    assert.equal(s.last, DATES[3])

    const blocks = await seriesBlocks(s.series_id)
    assert.deepEqual(
      blocks.map((b) => b.date),
      DATES,
    )
    const events = await seriesEvents(s.series_id)
    assert.equal(events.length, 4)
    for (const b of blocks) {
      assert.ok(b.event_id, '블록마다 일정과 연결')
      const ev = events.find((e) => e.id === b.event_id)
      assert.ok(ev)
      assert.equal(ev.title, '운동')
      assert.equal(ev.start_at, `${b.date}T19:00`)
      assert.equal(ev.end_at, `${b.date}T20:00`)
      assert.equal(ev.all_day, 0)
      assert.equal(ev.color, 'aqua')
      assert.equal(ev.description, '')
      assert.equal(ev.block_category, 'health')
    }
    await c.del(`/api/blocks/series/${s.series_id}`)
  })

  test('추가: 카테고리 기본값 work, 1440분 끝 → 일정 23:59', async () => {
    const s = await createSeries({ title: '밤', start_min: 1320, end_min: 1440 })
    assert.ok((await seriesBlocks(s.series_id)).every((b) => b.category === 'work'))
    const events = await seriesEvents(s.series_id)
    assert.ok(events.every((e) => e.color === 'blue' && e.end_at.endsWith('T23:59')))
    await c.del(`/api/blocks/series/${s.series_id}`)
  })

  test('추가: 할 일 연결 (내 할 일만)', async () => {
    const task = await c.post('/api/tasks', { title: '반복 블록 할 일', created_at: '2033-05-01T09:00' })
    expectStatus(task, 201)
    const s = await createSeries({ title: '할 일 블록', start_min: 600, end_min: 660, task_id: task.body.id })
    assert.ok((await seriesBlocks(s.series_id)).every((b) => b.task_id === task.body.id))
    expectStatus(await c.post('/api/blocks/series', { ...RANGE, title: 'x', start_min: 600, end_min: 660, task_id: 'nope' }), 404)
    await c.del(`/api/blocks/series/${s.series_id}`)
  })

  test('전체 수정: 날짜는 그대로, 블록과 일정의 제목 · 시간 · 색을 맞춤', async () => {
    const s = await createSeries({ title: '원래', category: 'study', start_min: 540, end_min: 600 })
    const res = await c.patch(`/api/blocks/series/${s.series_id}`, { title: '바뀜', category: 'meeting', start_min: 615, end_min: 690 })
    expectStatus(res, 200)
    assert.equal(res.body.updated, 4)

    const blocks = await seriesBlocks(s.series_id)
    assert.deepEqual(
      blocks.map((b) => [b.date, b.title, b.category, b.start_min, b.end_min]),
      DATES.map((d) => [d, '바뀜', 'meeting', 615, 690]),
    )
    const events = await seriesEvents(s.series_id)
    assert.deepEqual(
      events.map((e) => [e.start_at, e.end_at, e.title, e.color, e.all_day]),
      DATES.map((d) => [`${d}T10:15`, `${d}T11:30`, '바뀜', 'magenta', 0]),
    )
    await c.del(`/api/blocks/series/${s.series_id}`)
  })

  test('전체 수정: 현재 동작 — 카테고리를 안 보내면 work, 일정 색은 카테고리 색으로 다시 맞춤', async () => {
    const s = await createSeries({ title: '색', category: 'rest', start_min: 540, end_min: 600 })
    const [first] = await seriesEvents(s.series_id)
    expectStatus(await c.patch(`/api/events/${first.id}`, { color: 'violet' }), 200)

    expectStatus(await c.patch(`/api/blocks/series/${s.series_id}`, { title: '색', start_min: 540, end_min: 600 }), 200)
    assert.ok((await seriesBlocks(s.series_id)).every((b) => b.category === 'work'))
    assert.ok((await seriesEvents(s.series_id)).every((e) => e.color === 'blue'))
    await c.del(`/api/blocks/series/${s.series_id}`)
  })

  test('하나만 지우면 그 블록과 일정만 삭제 (블록 쪽 · 일정 쪽 모두)', async () => {
    const s = await createSeries({ title: '하나만', start_min: 540, end_min: 600 })
    const [b1, b2] = await seriesBlocks(s.series_id)
    expectStatus(await c.del(`/api/blocks/${b1.id}`), 200)
    expectStatus(await c.del(`/api/events/${b2.event_id}`), 200)
    assert.equal((await seriesBlocks(s.series_id)).length, 2)
    assert.equal((await seriesEvents(s.series_id)).length, 2)

    // 남은 것만 전체 수정 · 삭제됨
    const patched = await c.patch(`/api/blocks/series/${s.series_id}`, { title: '남은 것', start_min: 540, end_min: 600 })
    assert.equal(patched.body.updated, 2)
    assert.equal((await seriesEvents(s.series_id)).length, 2)
    const deleted = await c.del(`/api/blocks/series/${s.series_id}`)
    assert.equal(deleted.body.deleted, 2)
  })

  test('하나만 수정해도 연결된 일정은 그 블록만 따라감', async () => {
    const s = await createSeries({ title: '하나 수정', start_min: 540, end_min: 600 })
    const [b1, b2] = await seriesBlocks(s.series_id)
    expectStatus(await c.patch(`/api/blocks/${b1.id}`, { start_min: 480 }), 200)
    const events = await seriesEvents(s.series_id)
    assert.equal(events.find((e) => e.id === b1.event_id).start_at, `${b1.date}T08:00`)
    assert.equal(events.find((e) => e.id === b2.event_id).start_at, `${b2.date}T09:00`)
    await c.del(`/api/blocks/series/${s.series_id}`)
  })

  test('전체 삭제: 블록과 일정 모두 삭제, 다시 하면 404', async () => {
    const s = await createSeries({ title: '삭제', start_min: 540, end_min: 600 })
    const res = await c.del(`/api/blocks/series/${s.series_id}`)
    expectStatus(res, 200)
    assert.equal(res.body.deleted, 4)
    assert.equal((await seriesBlocks(s.series_id)).length, 0)
    assert.equal((await seriesEvents(s.series_id)).length, 0)
    expectStatus(await c.del(`/api/blocks/series/${s.series_id}`), 404)
    expectStatus(await c.patch(`/api/blocks/series/${s.series_id}`, { title: 'x', start_min: 540, end_min: 600 }), 404)
  })

  test('잘못된 값은 400, 아무것도 만들어지지 않음', async () => {
    const ok = { title: '검증', start_min: 540, end_min: 600, ...RANGE }
    for (const body of [
      { ...ok, end_min: 540 },
      { ...ok, end_min: 1441 },
      { ...ok, category: 'sleep' },
      { ...ok, title: '' },
      { ...ok, days: [] },
      { ...ok, until: '2033-04-30' },
      { title: ok.title, ...RANGE },
    ]) {
      expectStatus(await c.post('/api/blocks/series', body), 400)
    }
    assert.equal((await blocksOn(c, RANGE.from, RANGE.until)).length, 0)
    assert.equal((await eventsOn(c, RANGE.from, RANGE.until)).length, 0)
  })
})
