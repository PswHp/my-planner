/**
 * 탈퇴 기록 (deleted_users) + DB 복구 후 탈퇴자 다시 지우기 (scripts/restore-guard.ts)
 * 실제 탈퇴 → 기록 저장 → 'DB를 되돌린 상태'를 직접 만들어서 → 도구로 다시 지우기 까지 확인
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { client, dbQuery, emailOf, expectStatus, ROOT, STATE, userIdOf } from './helpers.ts'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const uid = userIdOf('returner')
const guard = (...args: string[]) => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'restore-guard.ts'), ...args, '--local', STATE], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  return r.stdout
}
const userCount = () => dbQuery<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE id = '${uid}'`)[0].n

describe('탈퇴 기록', () => {
  test('탈퇴하면 원래 ID 대신 해시와 탈퇴 시각만 남음', async () => {
    const c = client('returner')
    expectStatus(await c.post('/api/events', { title: '복구 테스트', start_at: '2030-10-01T09:00', end_at: '2030-10-01T10:00' }), 201)
    expectStatus(await c.del('/api/me', { confirm: emailOf('returner') }), 200)

    const rows = dbQuery<{ id_hash: string; deleted_at: string }>('SELECT id_hash, deleted_at FROM deleted_users')
    const mine = rows.find((r) => r.id_hash === sha(uid))
    assert.ok(mine, '탈퇴 기록이 있어야 함')
    assert.match(mine.deleted_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    assert.ok(!rows.some((r) => r.id_hash === uid), '원래 ID는 저장하지 않음')
  })

  test('보관 기간(30일)이 지난 기록은 앱을 열 때 지워지고, 기간 안의 기록은 남음', async () => {
    dbQuery(
      `INSERT INTO deleted_users (id_hash, deleted_at) VALUES ('old-hash', datetime('now', '-31 days')), ('recent-hash', datetime('now', '-29 days'))`,
    )
    expectStatus(await client('keeper').get('/api/me'), 200)
    const hashes = dbQuery<{ id_hash: string }>('SELECT id_hash FROM deleted_users').map((r) => r.id_hash)
    assert.ok(!hashes.includes('old-hash'))
    assert.ok(hashes.includes('recent-hash'))
    assert.ok(hashes.includes(sha(uid)))
  })
})

describe('DB 복구 후 탈퇴자 다시 지우기', () => {
  test('복구 전 저장 → (복구로 되살아난 계정) → 미리 보기 → --yes 로 삭제 + 탈퇴 기록 되살림', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'restore-guard-')), 'log.json')
    assert.match(guard('save', '--out', file), /탈퇴 기록 \d+건을 저장했습니다/)
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    assert.ok(saved.deleted_users.some((l: { id_hash: string }) => l.id_hash === sha(uid)))

    // DB를 탈퇴 전 시점으로 되돌린 상태 만들기: 계정 · 데이터는 다시 있고, 탈퇴 기록은 없음
    dbQuery(
      `INSERT INTO users (id, email, name, created_at) VALUES ('${uid}', '${emailOf('returner')}', 'Test returner', '2000-01-01 00:00:00');
       INSERT INTO events (id, user_id, title, start_at, end_at) VALUES ('revived-event', '${uid}', '되살아난 일정', '2030-10-01T09:00', '2030-10-01T10:00');
       DELETE FROM deleted_users WHERE id_hash = '${sha(uid)}'`,
    )
    assert.equal(userCount(), 1)

    const preview = guard('apply', file)
    assert.match(preview, /다시 지울 계정 1개/)
    assert.match(preview, /미리 보기입니다/)
    assert.equal(userCount(), 1, '미리 보기에서는 지우지 않음')

    assert.match(guard('apply', file, '--yes'), /1개 계정의 데이터를 다시 삭제/)
    assert.equal(userCount(), 0)
    assert.equal(dbQuery<{ n: number }>(`SELECT COUNT(*) AS n FROM events WHERE user_id = '${uid}'`)[0].n, 0)
    assert.equal(
      dbQuery<{ n: number }>(`SELECT COUNT(*) AS n FROM deleted_users WHERE id_hash = '${sha(uid)}'`)[0].n,
      1,
      '탈퇴 기록 되살림',
    )
  })

  test('탈퇴 후에 다시 가입한 계정은 지우지 않음', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'restore-guard-')), 'log.json')
    guard('save', '--out', file)
    dbQuery(
      `INSERT INTO users (id, email, name, created_at) VALUES ('${uid}', '${emailOf('returner')}', 'Rejoined', '2999-01-01 00:00:00')`,
    )
    assert.match(guard('apply', file, '--yes'), /0개 계정/)
    assert.equal(userCount(), 1)
    dbQuery(`DELETE FROM users WHERE id = '${uid}'`)
  })
})
