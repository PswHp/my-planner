/**
 * DB 복구(Cloudflare D1 Time Travel) 전후에 쓰는 도구 — 복구한 뒤, 그 사이에 탈퇴한 사용자의 데이터를 다시 지웁니다.
 * (개인정보처리방침 제3조의 약속. 탈퇴 기록은 DB 안에 있어서 복구하면 함께 되돌아가므로, 복구 전에 파일로 저장해 둡니다.)
 *
 *   1) 복구 전:  node scripts/restore-guard.ts save
 *                → .wrangler/restore-guard/deleted-users-<시각>.json 에 지금의 탈퇴 기록 저장
 *   2) 복구:     npx wrangler d1 time-travel restore planner-db --timestamp=<시각>
 *   3) 복구 후:  node scripts/restore-guard.ts apply <1에서 저장한 파일>         ← 지울 대상만 보여줌 (미리 보기)
 *                node scripts/restore-guard.ts apply <1에서 저장한 파일> --yes   ← 실제로 삭제 + 탈퇴 기록 되살림
 *
 * 대상 DB: 기본은 운영 DB(planner-db). --preview 는 미리보기 DB, --local <폴더> 는 로컬 DB(테스트용)
 * 저장 파일: --out <파일> 로 위치 지정 가능
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface DeletedLog {
  id_hash: string
  deleted_at: string
}
export interface UserRow {
  id: string
  created_at: string
}

export const hashId = (id: string) => createHash('sha256').update(id).digest('hex')

/**
 * 다시 지울 사용자 — 탈퇴 기록이 있고, 지금 DB의 계정이 탈퇴 '전에' 만들어진 것 (복구로 되살아난 계정)
 * 탈퇴 '후에' 다시 가입한 계정은 새 계정이므로 지우지 않음. (시각 형식: 'YYYY-MM-DD HH:MM:SS' UTC)
 */
export function usersToRedelete(users: UserRow[], log: DeletedLog[]): UserRow[] {
  const deletedAt = new Map(log.map((l) => [l.id_hash, l.deleted_at]))
  return users.filter((u) => {
    const at = deletedAt.get(hashId(u.id))
    return at !== undefined && u.created_at <= at
  })
}

/** 사용자 1명의 데이터를 모두 지우는 SQL (DELETE /api/me 와 같은 순서) */
export function redeleteSql(userId: string): string {
  const id = `'${userId.replace(/'/g, "''")}'`
  return [
    `DELETE FROM daily_rewards WHERE user_id = ${id}`,
    `DELETE FROM user_accessories WHERE user_id = ${id}`,
    `DELETE FROM time_blocks WHERE user_id = ${id}`,
    `DELETE FROM tasks WHERE user_id = ${id}`,
    `DELETE FROM events WHERE user_id = ${id}`,
    `DELETE FROM sessions WHERE user_id = ${id}`,
    `DELETE FROM users WHERE id = ${id}`,
  ].join('; ')
}

/* ------------------------------------------------------------------------ */

const ROOT = join(import.meta.dirname, '..')
const WRANGLER = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

function target(args: string[]) {
  const local = args.indexOf('--local')
  if (local !== -1) return ['planner-db', '--local', '--persist-to', args[local + 1]]
  if (args.includes('--preview')) return ['planner-db-preview', '--remote', '--env', 'preview']
  return ['planner-db', '--remote']
}

function d1<T>(args: string[], sql: string): T[] {
  const r = spawnSync(process.execPath, [WRANGLER, 'd1', 'execute', ...target(args), '--json', '--command', sql], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  })
  if (r.status !== 0) throw new Error(`wrangler d1 execute 실패\n${r.stdout}\n${r.stderr}`)
  return JSON.parse(r.stdout)[0].results
}

function save(args: string[]) {
  const log = d1<DeletedLog>(args, 'SELECT id_hash, deleted_at FROM deleted_users ORDER BY deleted_at')
  const outIdx = args.indexOf('--out')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = outIdx !== -1 ? args[outIdx + 1] : join(ROOT, '.wrangler', 'restore-guard', `deleted-users-${stamp}.json`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ saved_at: new Date().toISOString(), db: target(args)[0], deleted_users: log }, null, 2))
  console.log(`탈퇴 기록 ${log.length}건을 저장했습니다: ${file}`)
}

/** 복구로 사라진 탈퇴 기록을 되살리는 SQL (보관 기간 계산이 이어지도록, 더 늦은 시각을 남김) */
export function restoreLogSql(log: DeletedLog[]): string {
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`
  return log
    .map(
      (l) =>
        `INSERT INTO deleted_users (id_hash, deleted_at) VALUES (${q(l.id_hash)}, ${q(l.deleted_at)}) ` +
        `ON CONFLICT(id_hash) DO UPDATE SET deleted_at = MAX(deleted_at, excluded.deleted_at)`,
    )
    .join('; ')
}

function apply(args: string[]) {
  const file = args[1]
  if (!file || file.startsWith('--')) throw new Error('사용법: node scripts/restore-guard.ts apply <저장한 파일> [--yes]')
  const { deleted_users: log } = JSON.parse(readFileSync(file, 'utf8')) as { deleted_users: DeletedLog[] }
  const users = d1<UserRow>(args, 'SELECT id, created_at FROM users')
  const targets = usersToRedelete(users, log)

  console.log(`저장된 탈퇴 기록 ${log.length}건 / 복구로 되살아나 다시 지울 계정 ${targets.length}개`)
  for (const u of targets) console.log(`  - 계정 생성 ${u.created_at} (ID 해시 ${hashId(u.id).slice(0, 12)}…)`)
  if (!args.includes('--yes')) {
    console.log('미리 보기입니다. 실제로 지우려면 같은 명령 끝에 --yes 를 붙이세요.')
    return
  }
  const sql = [...targets.map((u) => redeleteSql(u.id)), restoreLogSql(log)].filter(Boolean).join('; ')
  if (sql) d1(args, sql)
  console.log(`${targets.length}개 계정의 데이터를 다시 삭제하고, 탈퇴 기록 ${log.length}건을 되살렸습니다.`)
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  try {
    if (args[0] === 'save') save(args)
    else if (args[0] === 'apply') apply(args)
    else {
      console.log('사용법: node scripts/restore-guard.ts save | apply <파일> [--yes]   (옵션: --preview, --local <폴더>, --out <파일>)')
      process.exitCode = 1
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exitCode = 1
  }
}
