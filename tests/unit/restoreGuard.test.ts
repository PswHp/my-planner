/** DB 복구 후 탈퇴자 다시 지우기 도구의 판단 로직 (scripts/restore-guard.ts) */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashId, redeleteSql, restoreLogSql, usersToRedelete } from '../../scripts/restore-guard.ts'

test('해시는 서버(functions/_lib/auth.ts sha256)와 같은 값', async () => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('1234567890'))
  const server = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  assert.equal(hashId('1234567890'), server)
})

test('탈퇴 전에 만들어진 계정(복구로 되살아난 계정)만 다시 지움', () => {
  const log = [
    { id_hash: hashId('revived'), deleted_at: '2030-01-10 12:00:00' },
    { id_hash: hashId('rejoined'), deleted_at: '2030-01-10 12:00:00' },
  ]
  const users = [
    { id: 'revived', created_at: '2030-01-01 09:00:00' }, // 탈퇴 전 계정 → 지움
    { id: 'rejoined', created_at: '2030-01-11 09:00:00' }, // 탈퇴 후 다시 가입 → 그대로
    { id: 'normal', created_at: '2030-01-01 09:00:00' }, // 탈퇴한 적 없음 → 그대로
  ]
  assert.deepEqual(
    usersToRedelete(users, log).map((u) => u.id),
    ['revived'],
  )
  assert.deepEqual(usersToRedelete(users, []), [])
})

test('삭제 SQL: 모든 표에서 그 사용자만, 따옴표는 이스케이프', () => {
  const sql = redeleteSql("a'b")
  for (const table of ['daily_rewards', 'user_accessories', 'time_blocks', 'tasks', 'events', 'sessions']) {
    assert.ok(sql.includes(`DELETE FROM ${table} WHERE user_id = 'a''b'`), table)
  }
  assert.ok(sql.includes(`DELETE FROM users WHERE id = 'a''b'`))
  assert.ok(!sql.includes(`'a'b'`))
})

test('탈퇴 기록 되살리기 SQL', () => {
  assert.equal(restoreLogSql([]), '')
  const sql = restoreLogSql([{ id_hash: 'h1', deleted_at: '2030-01-10 12:00:00' }])
  assert.match(sql, /INSERT INTO deleted_users \(id_hash, deleted_at\) VALUES \('h1', '2030-01-10 12:00:00'\)/)
  assert.match(sql, /ON CONFLICT\(id_hash\) DO UPDATE SET deleted_at = MAX\(deleted_at, excluded.deleted_at\)/)
})
