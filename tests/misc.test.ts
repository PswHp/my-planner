/** 로그인 · 보안(미들웨어) · 사용자 간 격리 · 내 정보 · 접속 보상 · 통계 · 내보내기 · 로그아웃 · 탈퇴 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { BASE, client, dbQuery, emailOf, EXPIRED_TOKEN, expectStatus, request, tokenOf, userIdOf } from './helpers.ts'

const me = client('misc')
const intruder = client('intruder')
const ACCESSORY_IDS = ['ribbon_red', 'glasses_round', 'sprout_pin', 'scarf_pink', 'cap_orange', 'ear_ribbon', 'crown_gold']

describe('미들웨어: 로그인 · 요청 출처 · 보안 헤더', () => {
  test('로그인 안 했거나 세션이 없거나 만료됐으면 401', async () => {
    expectStatus(await request('GET', '/api/me'), 401)
    expectStatus(await request('GET', '/api/me', { headers: { cookie: 'sid=wrong-token' } }), 401)
    expectStatus(await request('GET', '/api/me', { headers: { cookie: `sid=${EXPIRED_TOKEN}` } }), 401)
    expectStatus(await request('GET', '/api/me', { headers: { cookie: `sid=${'a'.repeat(129)}` } }), 401)
    expectStatus(await request('GET', '/api/tasks', { headers: { cookie: `__Host-sid=${tokenOf('misc')}` } }), 401)
  })

  test('상태 변경 요청은 이 사이트 Origin 일 때만 (CSRF 방어)', async () => {
    const cookie = `sid=${tokenOf('misc')}`
    const body = { title: 'csrf', created_at: '2030-07-01T09:00' }
    expectStatus(await request('POST', '/api/tasks', { body, headers: { cookie } }), 403)
    expectStatus(await request('POST', '/api/tasks', { body, headers: { cookie, origin: 'https://evil.example' } }), 403)
    expectStatus(await request('DELETE', '/api/me', { body: { confirm: emailOf('misc') }, headers: { cookie } }), 403)
    // 로그인 확인보다 먼저 검사
    expectStatus(await request('POST', '/api/tasks', { body }), 403)
    expectStatus(await request('POST', '/api/tasks', { body, headers: { origin: BASE } }), 401)
  })

  test('API 응답에 보안 헤더 (에러 응답 포함)', async () => {
    for (const res of [await me.get('/api/me'), await request('GET', '/api/me')]) {
      assert.equal(res.headers.get('cache-control'), 'no-store')
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
      assert.equal(res.headers.get('x-frame-options'), 'DENY')
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
      assert.match(res.headers.get('content-type') ?? '', /application\/json/)
    }
  })

  test('본문이 JSON 객체가 아니면 400, 너무 크면 413', async () => {
    const headers = { cookie: `sid=${tokenOf('misc')}`, origin: BASE, 'content-type': 'application/json' }
    for (const body of ['not json', '[1,2]', 'null', '"text"']) {
      const r = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers, body })
      assert.equal(r.status, 400, body)
    }
    const big = await me.post('/api/tasks', { title: 'big', created_at: '2030-07-01T09:00', notes: 'a'.repeat(33 * 1024) })
    expectStatus(big, 413)
  })
})

describe('사용자 간 격리', () => {
  test('다른 사용자의 일정 · 블록 · 할 일 · 반복은 보이지도, 고치거나 지울 수도 없음 (404)', async () => {
    const ev = (await me.post('/api/events', { title: '내 일정', start_at: '2030-08-01T09:00', end_at: '2030-08-01T10:00' })).body
    const task = (await me.post('/api/tasks', { title: '내 할 일', created_at: '2030-08-01T09:00' })).body
    const blocks = (await me.get('/api/blocks?from=2030-08-01&to=2030-08-01')).body
    const block = blocks.find((b: any) => b.event_id === ev.id)
    const evSeries = (
      await me.post('/api/events/series', {
        title: '내 반복',
        start_time: '09:00',
        end_time: '10:00',
        from: '2030-08-04',
        until: '2030-08-05',
        days: [1],
      })
    ).body
    const blSeries = (
      await me.post('/api/blocks/series', {
        title: '내 반복 블록',
        start_min: 60,
        end_min: 120,
        from: '2030-08-04',
        until: '2030-08-05',
        days: [1],
      })
    ).body
    const tkSeries = (
      await me.post('/api/tasks/series', {
        title: '내 반복 할 일',
        created_at: '2030-08-01T09:00',
        from: '2030-08-04',
        until: '2030-08-05',
        days: [1],
      })
    ).body

    assert.equal((await intruder.get('/api/events?from=2030-08-01&to=2030-08-31')).body.length, 0)
    assert.equal((await intruder.get('/api/blocks?from=2030-08-01&to=2030-08-31')).body.length, 0)
    assert.equal((await intruder.get('/api/tasks')).body.length, 0)

    for (const res of [
      await intruder.patch(`/api/events/${ev.id}`, { title: '해킹' }),
      await intruder.del(`/api/events/${ev.id}`),
      await intruder.patch(`/api/blocks/${block.id}`, { title: '해킹' }),
      await intruder.del(`/api/blocks/${block.id}`),
      await intruder.patch(`/api/tasks/${task.id}`, { title: '해킹' }),
      await intruder.del(`/api/tasks/${task.id}`),
      await intruder.patch(`/api/events/series/${evSeries.series_id}`, { title: '해킹', start_time: '09:00', end_time: '10:00' }),
      await intruder.del(`/api/events/series/${evSeries.series_id}`),
      await intruder.patch(`/api/blocks/series/${blSeries.series_id}`, { title: '해킹', start_min: 60, end_min: 120 }),
      await intruder.del(`/api/blocks/series/${blSeries.series_id}`),
      await intruder.patch(`/api/tasks/series/${tkSeries.series_id}`, { title: '해킹' }),
      await intruder.del(`/api/tasks/series/${tkSeries.series_id}`),
      // 남의 할 일을 내 블록에 연결할 수도 없음
      await intruder.post('/api/blocks', { date: '2030-08-02', start_min: 60, end_min: 120, title: 'x', task_id: task.id }),
    ]) {
      expectStatus(res, 404)
    }

    // 원래 주인의 데이터는 그대로
    const events = (await me.get('/api/events?from=2030-08-01&to=2030-08-31')).body
    assert.equal(events.find((e: any) => e.id === ev.id).title, '내 일정')
    assert.equal(events.length, 1 + 1 + 1, '일정 1 + 반복 일정 1 + 반복 블록의 일정 1')
    assert.equal((await me.get('/api/blocks?from=2030-08-01&to=2030-08-31')).body.length, 3)
    assert.equal((await me.get('/api/tasks')).body.filter((t: any) => t.title.startsWith('내')).length, 2)
  })
})

describe('내 정보 · 일일 접속 보상', () => {
  test('보상은 하루 한 번: 두 번째부터는 같은 결과를 돌려주고 코인을 더 주지 않음', async () => {
    let info = await me.get('/api/me')
    expectStatus(info, 200)
    assert.equal(info.body.id, userIdOf('misc'))
    assert.equal(info.body.email, emailOf('misc'))
    assert.equal(info.body.coins, 0)
    assert.equal(info.body.dailyReward.claimed, false)
    assert.match(info.body.dailyReward.date, /^\d{4}-\d{2}-\d{2}$/)

    const first = await me.post('/api/rewards/daily')
    expectStatus(first, 200)
    assert.equal(first.body.alreadyClaimed, false)
    assert.equal(first.body.duplicate, false, '처음 받는 액세서리는 중복이 아님')
    assert.ok(ACCESSORY_IDS.includes(first.body.accessory.id))
    assert.equal(first.body.coins, 10)
    assert.equal(first.body.baseCoins, 10)
    assert.equal(first.body.totalCoins, 10)
    assert.equal(first.body.date, info.body.dailyReward.date)

    const again = await Promise.all([me.post('/api/rewards/daily'), me.post('/api/rewards/daily')])
    for (const r of again) {
      expectStatus(r, 200)
      assert.equal(r.body.alreadyClaimed, true)
      assert.equal(r.body.accessory.id, first.body.accessory.id)
      assert.equal(r.body.totalCoins, 10)
    }

    info = await me.get('/api/me')
    assert.equal(info.body.coins, 10)
    assert.equal(info.body.dailyReward.claimed, true)
  })
})

describe('통계 · 내보내기', () => {
  test('통계: 기간 안의 할 일 · 블록 · 일정 집계', async () => {
    const stats = client('misc')
    const created_at = '2030-06-20T09:00'
    // 통계 기간: 2030-07-01 ~ 07-07, 오늘 = 07-05
    expectStatus(await stats.post('/api/tasks', { title: 's1', due_date: '2030-07-01', created_at }), 201)
    expectStatus(
      await stats.post('/api/tasks', { title: 's2', due_date: '2030-07-02', done: true, completed_at: '2030-07-02T10:00', created_at }),
      201,
    )
    expectStatus(await stats.post('/api/tasks', { title: 's3', due_date: '2030-07-03', created_at }), 201)
    expectStatus(await stats.post('/api/blocks', { date: '2030-07-02', start_min: 600, end_min: 660, title: 'b1', category: 'study' }), 201)
    expectStatus(await stats.post('/api/blocks', { date: '2030-07-03', start_min: 600, end_min: 630, title: 'b2', category: 'work' }), 201)
    expectStatus(
      await stats.post('/api/events', { title: 'e1', start_at: '2030-07-04T00:00', end_at: '2030-07-04T23:59', all_day: true }),
      201,
    )

    const before = (await stats.get('/api/tasks')).body.filter((t: any) => !t.done).length
    const res = await stats.get('/api/stats?from=2030-07-01&to=2030-07-07&today=2030-07-05')
    expectStatus(res, 200)
    assert.deepEqual(res.body.completedByDay, [{ date: '2030-07-02', count: 1 }])
    assert.equal(res.body.dueTotal, 3)
    assert.equal(res.body.dueDone, 1)
    assert.equal(res.body.openTasks, before, '안 한 일은 기간과 상관없이 전부')
    assert.equal(res.body.overdueTasks, 2)
    assert.deepEqual(res.body.blocksByCategory, [
      { category: 'study', minutes: 60 },
      { category: 'work', minutes: 30 },
    ])
    assert.deepEqual(res.body.blocksByDay, [
      { date: '2030-07-02', minutes: 60 },
      { date: '2030-07-03', minutes: 30 },
    ])
    assert.equal(res.body.eventCount, 3, '블록 2개의 연결 일정 + 종일 일정 1개')

    expectStatus(await stats.get('/api/stats?from=2030-07-01&to=2030-07-07'), 400)
  })

  test('내보내기: 내 데이터만, user_id 없이, 파일 다운로드로', async () => {
    const res = await me.get('/api/export')
    expectStatus(res, 200)
    assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="planner-export.json"/)
    const body = res.body
    assert.equal(body.user.email, emailOf('misc'))
    assert.ok(body.events.length > 0 && body.tasks.length > 0 && body.time_blocks.length > 0)
    for (const row of [...body.events, ...body.tasks, ...body.time_blocks]) assert.equal('user_id' in row, false)
    assert.equal(body.coins, 10)
    assert.equal(body.accessories.length, 1)
    assert.equal(body.daily_rewards.length, 1)
    assert.ok(!Number.isNaN(Date.parse(body.exported_at)))
  })
})

describe('로그아웃 · 회원 탈퇴', () => {
  test('로그아웃하면 세션이 지워지고 쿠키도 비움', async () => {
    expectStatus(await intruder.get('/api/me'), 200)
    const res = await intruder.post('/api/auth/logout')
    expectStatus(res, 200)
    assert.match(res.headers.get('set-cookie') ?? '', /^sid=; .*Max-Age=0/)
    expectStatus(await intruder.get('/api/me'), 401)
  })

  test('탈퇴: 확인 이메일이 맞아야 하고, 내 데이터와 세션을 모두 지움 (다른 사용자는 그대로)', async () => {
    const leaver = client('leaver')
    expectStatus(await leaver.post('/api/events', { title: '탈퇴 일정', start_at: '2030-09-01T09:00', end_at: '2030-09-01T10:00' }), 201)
    expectStatus(await leaver.post('/api/tasks', { title: '탈퇴 할 일', created_at: '2030-09-01T09:00' }), 201)
    expectStatus(await leaver.post('/api/rewards/daily'), 200)

    expectStatus(await leaver.del('/api/me', { confirm: 'wrong@test.local' }), 400)
    expectStatus(await leaver.del('/api/me', {}), 400)
    expectStatus(await leaver.get('/api/me'), 200)

    const res = await leaver.del('/api/me', { confirm: emailOf('leaver') })
    expectStatus(res, 200)
    assert.match(res.headers.get('set-cookie') ?? '', /^sid=; .*Max-Age=0/)
    expectStatus(await leaver.get('/api/me'), 401)

    const uid = userIdOf('leaver')
    const [left] = dbQuery<Record<string, number>>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE id = '${uid}') AS users,
         (SELECT COUNT(*) FROM sessions WHERE user_id = '${uid}') AS sessions,
         (SELECT COUNT(*) FROM events WHERE user_id = '${uid}') AS events,
         (SELECT COUNT(*) FROM time_blocks WHERE user_id = '${uid}') AS blocks,
         (SELECT COUNT(*) FROM tasks WHERE user_id = '${uid}') AS tasks,
         (SELECT COUNT(*) FROM daily_rewards WHERE user_id = '${uid}') AS rewards,
         (SELECT COUNT(*) FROM user_accessories WHERE user_id = '${uid}') AS accessories`,
    )
    assert.deepEqual(left, { users: 0, sessions: 0, events: 0, blocks: 0, tasks: 0, rewards: 0, accessories: 0 })
    expectStatus(await me.get('/api/me'), 200)
  })
})
