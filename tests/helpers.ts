/**
 * API 테스트 공통 도구
 * - 서버는 tests/setup.ts 가 테스트 전에 띄웁니다 (wrangler pages dev, 테스트 전용 로컬 DB).
 * - 테스트 파일마다 다른 사용자로 로그인해서 서로의 데이터가 섞이지 않게 합니다.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

export const ROOT = join(import.meta.dirname, '..')
/** 테스트 전용 로컬 DB 위치 (개발용 .wrangler/state 와 분리) */
export const STATE = join(ROOT, '.wrangler', 'test-state')
export const WRANGLER = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

export const PORT = 8799
export const BASE = `http://127.0.0.1:${PORT}`

/** setup.ts 가 미리 만들어 두는 테스트 사용자들 (테스트 파일당 하나씩) */
export const TEST_USERS = ['events', 'blocks', 'eventSeries', 'blockSeries', 'tasks', 'misc', 'intruder', 'leaver'] as const
export type TestUser = (typeof TEST_USERS)[number]

export const tokenOf = (user: TestUser) => `test-session-token-${user}`
export const userIdOf = (user: TestUser) => `test-user-${user}`
export const emailOf = (user: TestUser) => `${user}@test.local`
/** setup.ts 가 넣어 두는 만료된 세션의 토큰 */
export const EXPIRED_TOKEN = 'test-session-token-expired'

export function wrangler(args: string[]) {
  const r = spawnSync(process.execPath, [WRANGLER, ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CI: '1' } })
  if (r.status !== 0)
    throw new Error(`wrangler ${args.join(' ')} 실패
${r.stdout}
${r.stderr}`)
  return r.stdout
}

/** 테스트 DB에 직접 SQL 실행 (API로 볼 수 없는 것을 확인할 때만) */
export function dbQuery<T = Record<string, unknown>>(sql: string): T[] {
  const out = wrangler(['d1', 'execute', 'planner-db', '--local', '--persist-to', STATE, '--json', '--command', sql])
  return JSON.parse(out)[0].results
}

export interface Res<T = any> {
  status: number
  body: T
  headers: Headers
}

export interface Client {
  get<T = any>(path: string): Promise<Res<T>>
  post<T = any>(path: string, body?: unknown): Promise<Res<T>>
  patch<T = any>(path: string, body?: unknown): Promise<Res<T>>
  del<T = any>(path: string, body?: unknown): Promise<Res<T>>
}

export async function request<T = any>(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const r = await fetch(BASE + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
  const text = await r.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    /* JSON이 아니면 문자열 그대로 */
  }
  return { status: r.status, body: body as T, headers: r.headers }
}

/** 로그인된 사용자로 요청 (상태 변경 요청에는 이 사이트의 Origin 헤더를 붙임) */
export function client(user: TestUser): Client {
  const call = (method: string) => (path: string, body?: unknown) =>
    request(method, path, { body, headers: { cookie: `sid=${tokenOf(user)}`, ...(method === 'GET' ? {} : { origin: BASE }) } })
  return { get: call('GET'), post: call('POST'), patch: call('PATCH'), del: call('DELETE') }
}

/** 상태 코드 확인 (실패하면 응답 본문을 함께 보여줌) */
export function expectStatus(res: Res, status: number) {
  assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`)
}

/** 하루치 블록 목록 */
export async function blocksOn(c: Client, date: string, to = date) {
  const res = await c.get(`/api/blocks?from=${date}&to=${to}`)
  expectStatus(res, 200)
  return res.body as any[]
}

/** 기간 안의 일정 목록 */
export async function eventsOn(c: Client, from: string, to = from) {
  const res = await c.get(`/api/events?from=${from}&to=${to}`)
  expectStatus(res, 200)
  return res.body as any[]
}
