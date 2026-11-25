/** 반복 일정 API + 반복 일정 ↔ 블록 일괄 연결 (functions/api/events/series, link.ts) */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { blocksOn, client, eventsOn, expectStatus } from './helpers.ts'

const c = client('eventSeries')

// 2032-03-01(월) ~ 2032-03-14(일), 월 · 수 → 4개
const RANGE = { from: '2032-03-01', until: '2032-03-14', days: [1, 3] }
const DATES = ['2032-03-01', '2032-03-03', '2032-03-08', '2032-03-10']

async function createSeries(body: Record<string, unknown>) {
  const res = await c.post('/api/events/series', { ...RANGE, ...body })
  expectStatus(res, 201)
  return res.body as { series_id: string; count: number; first: string; last: string }
}

const seriesEvents = async (id: string) => (await eventsOn(c, RANGE.from, RANGE.until)).filter((e) => e.series_id === id)
const seriesBlocks = async (id: string) => (await blocksOn(c, RANGE.from, RANGE.until)).filter((b) => b.series_id === id)

async function cleanup(id: string) {
  await c.del(`/api/events/series/${id}`)
}

describe('반복 일정', () => {
  test('추가: 선택한 요일마다 일정 + 연결된 블록 생성', async () => {
    const s = await createSeries({ title: '수영', description: '자유형', color: 'aqua', start_time: '07:00', end_time: '08:00' })
    assert.equal(s.count, 4)
    assert.equal(s.first, DATES[0])
    assert.equal(s.last, DATES[3])

    const events = await seriesEvents(s.series_id)
    assert.deepEqual(
      events.map((e) => e.start_at),
      DATES.map((d) => `${d}T07:00`),
    )
    for (const e of events) {
      assert.equal(e.title, '수영')
      assert.equal(e.description, '자유형')
      assert.equal(e.end_at, `${e.start_at.slice(0, 10)}T08:00`)
      assert.equal(e.all_day, 0)
      assert.equal(e.block_category, 'health')
    }

    const blocks = await seriesBlocks(s.series_id)
    assert.equal(blocks.length, 4)
    for (const b of blocks) {
      const ev = events.find((e) => e.id === b.event_id)
      assert.ok(ev, '블록마다 같은 날 일정과 연결')
      assert.equal(b.date, ev.start_at.slice(0, 10))
      assert.equal(b.start_min, 420)
      assert.equal(b.end_min, 480)
      assert.equal(b.title, '수영')
      assert.equal(b.category, 'health')
    }
    await cleanup(s.series_id)
  })

  test('추가: 카테고리를 고르면 블록은 그 카테고리 / 종일이면 블록 없음 / 기본값', async () => {
    const withCat = await createSeries({ title: '스터디', color: 'blue', start_time: '20:00', end_time: '21:00', category: 'study' })
    assert.ok((await seriesBlocks(withCat.series_id)).every((b) => b.category === 'study'))

    const allDay = await createSeries({ title: '종일 반복', all_day: true })
    const events = await seriesEvents(allDay.series_id)
    assert.equal(events.length, 4)
    assert.ok(events.every((e) => e.all_day === 1 && e.start_at.endsWith('T00:00') && e.end_at.endsWith('T23:59')))
    assert.equal(events[0].color, 'blue', '색 기본값')
    assert.equal(events[0].description, '', '메모 기본값')
    assert.equal((await seriesBlocks(allDay.series_id)).length, 0)

    await cleanup(withCat.series_id)
    await cleanup(allDay.series_id)
  })

  test('전체 수정: 날짜는 그대로, 제목 · 시간 · 카테고리를 일정과 블록 모두에 반영', async () => {
    const s = await createSeries({ title: '원래', color: 'orange', start_time: '09:00', end_time: '10:00' })
    const res = await c.patch(`/api/events/series/${s.series_id}`, {
      title: '바뀜',
      description: '메모',
      color: 'magenta',
      start_time: '13:30',
      end_time: '15:00',
      category: 'meeting',
    })
    expectStatus(res, 200)
    assert.equal(res.body.updated, 4)

    const events = await seriesEvents(s.series_id)
    assert.deepEqual(
      events.map((e) => [e.start_at, e.end_at, e.title, e.color, e.description]),
      DATES.map((d) => [`${d}T13:30`, `${d}T15:00`, '바뀜', 'magenta', '메모']),
    )
    const blocks = await seriesBlocks(s.series_id)
    assert.equal(blocks.length, 4)
    assert.ok(blocks.every((b) => b.start_min === 810 && b.end_min === 900 && b.title === '바뀜' && b.category === 'meeting'))
    await cleanup(s.series_id)
  })

  test('전체 수정: 카테고리를 안 보내면 블록 카테고리 유지', async () => {
    const s = await createSeries({ title: '유지', color: 'orange', start_time: '09:00', end_time: '10:00', category: 'rest' })
    expectStatus(
      await c.patch(`/api/events/series/${s.series_id}`, { title: '유지2', color: 'blue', start_time: '09:00', end_time: '11:00' }),
      200,
    )
    assert.ok((await seriesBlocks(s.series_id)).every((b) => b.category === 'rest' && b.end_min === 660))
    await cleanup(s.series_id)
  })

  test('전체 수정: 종일로 바꾸면 블록 삭제, 다시 시간 일정으로 바꾸면 블록 재생성', async () => {
    const s = await createSeries({ title: '전환', color: 'green', start_time: '09:00', end_time: '10:00' })
    expectStatus(await c.patch(`/api/events/series/${s.series_id}`, { title: '전환', color: 'green', all_day: true }), 200)
    assert.equal((await seriesBlocks(s.series_id)).length, 0)
    assert.ok(
      (await seriesEvents(s.series_id)).every((e) => e.all_day === 1 && e.start_at.endsWith('T00:00') && e.end_at.endsWith('T23:59')),
    )

    expectStatus(
      await c.patch(`/api/events/series/${s.series_id}`, {
        title: '전환',
        color: 'green',
        all_day: false,
        start_time: '18:00',
        end_time: '19:00',
      }),
      200,
    )
    const blocks = await seriesBlocks(s.series_id)
    assert.equal(blocks.length, 4)
    assert.ok(blocks.every((b) => b.start_min === 1080 && b.category === 'rest'))
    await cleanup(s.series_id)
  })

  test('하나만 수정하면 그 일정과 블록만 바뀌고, 반복 묶음은 유지', async () => {
    const s = await createSeries({ title: '하나만', start_time: '09:00', end_time: '10:00' })
    const [first, second] = await seriesEvents(s.series_id)
    expectStatus(
      await c.patch(`/api/events/${first.id}`, { title: '첫 번째만', start_at: `${DATES[0]}T11:00`, end_at: `${DATES[0]}T12:00` }),
      200,
    )

    const blocks = await seriesBlocks(s.series_id)
    assert.equal(blocks.find((b) => b.event_id === first.id).start_min, 660)
    assert.equal(blocks.find((b) => b.event_id === second.id).start_min, 540)
    assert.equal((await seriesEvents(s.series_id)).length, 4)

    // 하나만 삭제하면 그 일정과 블록만 지워짐
    expectStatus(await c.del(`/api/events/${second.id}`), 200)
    assert.equal((await seriesEvents(s.series_id)).length, 3)
    assert.equal((await seriesBlocks(s.series_id)).length, 3)
    await cleanup(s.series_id)
  })

  test('전체 삭제: 일정과 블록 모두 삭제, 다시 하면 404', async () => {
    const s = await createSeries({ title: '삭제', start_time: '09:00', end_time: '10:00' })
    const res = await c.del(`/api/events/series/${s.series_id}`)
    expectStatus(res, 200)
    // 현재 동작: D1 이 함께 지워진(ON DELETE CASCADE) 블록 4개까지 세어서 8 (화면에서는 이 값을 쓰지 않음)
    assert.equal(res.body.deleted, 8)
    assert.equal((await seriesEvents(s.series_id)).length, 0)
    assert.equal((await seriesBlocks(s.series_id)).length, 0)
    expectStatus(await c.del(`/api/events/series/${s.series_id}`), 404)
    expectStatus(await c.patch(`/api/events/series/${s.series_id}`, { title: 'x', start_time: '09:00', end_time: '10:00' }), 404)
  })

  test('잘못된 값은 400, 아무것도 만들어지지 않음', async () => {
    const ok = { title: '검증', start_time: '09:00', end_time: '10:00', ...RANGE }
    for (const body of [
      { ...ok, until: '2032-02-28' },
      { ...ok, days: [] },
      { ...ok, days: [7] },
      { ...ok, days: [1.5] },
      { ...ok, days: [0, 1, 2, 3, 4, 5, 6, 0] },
      { ...ok, days: 'mon' },
      { ...ok, from: '2032-03-01', until: '2032-03-01', days: [0] }, // 월요일 하루에 일요일 없음
      { ...ok, from: '2032-01-01', until: '2033-01-02' }, // 368일
      { ...ok, start_time: '9:00' },
      { ...ok, end_time: '24:00' },
      { ...ok, end_time: '08:00' },
      { ...ok, color: 'pink' },
      { ...ok, category: 'sleep' },
      { ...ok, title: '' },
    ]) {
      expectStatus(await c.post('/api/events/series', body), 400)
    }
    assert.equal((await eventsOn(c, '2032-01-01', '2033-01-02')).length, 0)
  })

  test('최대 기간(366일)까지는 허용', async () => {
    const s = await c.post('/api/events/series', { title: '1년', all_day: true, from: '2034-01-01', until: '2035-01-01', days: [0] })
    expectStatus(s, 201)
    assert.equal(s.body.count, 53)
    await cleanup(s.body.series_id)
  })
})
