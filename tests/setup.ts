/**
 * 테스트 전체 준비 · 정리 (node --test-global-setup)
 * 1) 테스트 전용 로컬 DB(.wrangler/test-state)를 새로 만들고 마이그레이션 적용
 * 2) 테스트 사용자 + 로그인 세션을 DB에 직접 넣음 (Google 로그인 없이 쿠키로 접속)
 * 3) wrangler pages dev 를 띄우고, 테스트가 끝나면 종료
 * 개발용 로컬 DB(.wrangler/state)와 운영 · 미리보기 DB는 건드리지 않습니다.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, emailOf, EXPIRED_TOKEN, PORT, ROOT, STATE, TEST_USERS, tokenOf, userIdOf, WRANGLER, wrangler } from './helpers.ts'

let server: ChildProcess | undefined

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const q = (s: string) => `'${s.replace(/'/g, "''")}'`

function seedSql() {
  const expires = Date.now() + 24 * 60 * 60 * 1000
  const lines = TEST_USERS.flatMap((u) => [
    `INSERT INTO users (id, email, name) VALUES (${q(userIdOf(u))}, ${q(emailOf(u))}, ${q(`Test ${u}`)});`,
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (${q(sha256(tokenOf(u)))}, ${q(userIdOf(u))}, ${expires});`,
  ])
  // 만료된 세션
  lines.push(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (${q(sha256(EXPIRED_TOKEN))}, ${q(userIdOf('misc'))}, ${Date.now() - 1000});`,
  )
  // 일정 연결 기능(마이그레이션 0006) 이전에 만들어진, 일정과 연결되지 않은 블록
  lines.push(
    `INSERT INTO time_blocks (id, user_id, date, start_min, end_min, title, category)
     VALUES ('legacy-block', ${q(userIdOf('blocks'))}, '2031-03-10', 600, 660, '예전 블록', 'study');`,
  )
  return lines.join('\n')
}

async function waitForServer(proc: ChildProcess, log: () => string) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`wrangler pages dev 가 종료됨 (code ${proc.exitCode})\n${log()}`)
    try {
      const r = await fetch(`${BASE}/api/me`, { headers: { cookie: `sid=${tokenOf('misc')}` } })
      if (r.status === 200) return
    } catch {
      /* 아직 준비 안 됨 */
    }
    await new Promise((ok) => setTimeout(ok, 300))
  }
  throw new Error(`서버가 60초 안에 준비되지 않았습니다.\n${log()}`)
}

function stopServer() {
  if (!server?.pid || server.exitCode !== null) return
  // Windows에서는 자식(workerd)까지 함께 종료해야 포트가 풀림
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'])
  else process.kill(-server.pid, 'SIGTERM')
}

export async function globalSetup() {
  rmSync(STATE, { recursive: true, force: true })
  mkdirSync(STATE, { recursive: true })
  mkdirSync(join(ROOT, 'dist'), { recursive: true }) // API 테스트에는 정적 파일이 필요 없음

  wrangler(['d1', 'migrations', 'apply', 'planner-db', '--local', '--persist-to', STATE])
  const seedFile = join(STATE, 'seed.sql')
  writeFileSync(seedFile, seedSql())
  wrangler(['d1', 'execute', 'planner-db', '--local', '--persist-to', STATE, '--file', seedFile])

  let output = ''
  server = spawn(
    process.execPath,
    [
      WRANGLER,
      'pages',
      'dev',
      'dist',
      '--ip',
      '127.0.0.1',
      '--port',
      String(PORT),
      '--persist-to',
      STATE,
      '--binding',
      `APP_URL=${BASE}`,
      '--show-interactive-dev-session=false',
      '--inspector-port',
      '0',
    ],
    { cwd: ROOT, env: { ...process.env, CI: '1' }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  server.stdout?.on('data', (d) => (output += d))
  server.stderr?.on('data', (d) => (output += d))
  process.on('exit', stopServer)

  try {
    await waitForServer(server, () => output.slice(-4000))
  } catch (e) {
    stopServer()
    throw e
  }
}

export async function globalTeardown() {
  stopServer()
}
