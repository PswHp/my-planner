/** 타임 블록 화면에서 겹치는 항목을 나란히 놓는 계산 (src/lib/timeline.ts) */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layoutBlocks } from '../../src/lib/timeline.ts'

const b = (id: string, start_min: number, end_min: number) => ({ id, start_min, end_min })
const view = (items: ReturnType<typeof layoutBlocks<ReturnType<typeof b>>>) => items.map((x) => `${x.block.id}:${x.lane}/${x.lanes}`)

test('겹치지 않으면 모두 한 줄 (끝 = 다음 시작이어도 겹치지 않음)', () => {
  assert.deepEqual(view(layoutBlocks([b('B', 60, 120), b('A', 0, 60)])), ['A:0/1', 'B:0/1'])
})

test('겹치면 나란히, 빈 자리는 다시 씀', () => {
  // A(0-60) B(30-90) C(60-120) → A·C 는 0번, B 는 1번 자리, 모두 2칸
  assert.deepEqual(view(layoutBlocks([b('C', 60, 120), b('B', 30, 90), b('A', 0, 60)])), ['A:0/2', 'B:1/2', 'C:0/2'])
})

test('겹침 묶음이 끝나면 칸 수를 새로 셈', () => {
  const out = view(layoutBlocks([b('A', 0, 60), b('B', 0, 60), b('C', 0, 30), b('D', 60, 90)]))
  assert.deepEqual(out, ['A:0/3', 'B:1/3', 'C:2/3', 'D:0/1'])
})

test('같은 시각에 시작하면 긴 것이 먼저', () => {
  assert.deepEqual(view(layoutBlocks([b('short', 0, 30), b('long', 0, 120)])), ['long:0/2', 'short:1/2'])
})

test('빈 목록', () => {
  assert.deepEqual(layoutBlocks([]), [])
})
