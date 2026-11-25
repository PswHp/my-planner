/** 처음 온 사람을 위한 사용법 안내 (src/lib/guide.ts) */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import {
  GUIDE_LAYOUT,
  GUIDE_STEPS,
  guideSeen,
  markGuideSeen,
  placeCard,
  splitEmphasis,
  spotlightBox,
  visibleSteps,
} from '../../src/lib/guide.ts'

function useStorage(storage: unknown) {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
}

describe('봤는지 기억 (이 브라우저 기준)', () => {
  test('처음엔 안 봄 → 기록하면 봄', () => {
    const data = new Map<string, string>()
    useStorage({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) })
    assert.equal(guideSeen(), false)
    markGuideSeen()
    assert.equal(guideSeen(), true)
    assert.equal(data.get('dailumi:guide-seen'), '1')
  })

  test('저장소를 쓸 수 없으면 자동으로 띄우지 않고, 기록도 오류 없이 넘어감', () => {
    const fail = () => {
      throw new Error('blocked')
    }
    useStorage({ getItem: fail, setItem: fail })
    assert.equal(guideSeen(), true)
    assert.doesNotThrow(() => markGuideSeen())
  })
})

describe('안내 단계', () => {
  test('처음과 끝은 화면 가운데 안내, 동물 친구는 첫 인사에만, 제목은 겹치지 않음', () => {
    assert.equal(GUIDE_STEPS[0].target, undefined)
    assert.deepEqual(
      GUIDE_STEPS.map((s) => !!s.hero),
      GUIDE_STEPS.map((_, i) => i === 0),
    )
    assert.equal(GUIDE_STEPS[GUIDE_STEPS.length - 1].target, undefined)
    assert.equal(new Set(GUIDE_STEPS.map((s) => s.title)).size, GUIDE_STEPS.length)
  })

  test('단계가 가리키는 data-tour 요소가 화면 코드에 실제로 있음', () => {
    const src = join(import.meta.dirname, '..', '..', 'src')
    const code = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => readFileSync(join(src, f), 'utf8'))
      .join('\n')
    for (const s of GUIDE_STEPS) {
      if (s.target) assert.ok(code.includes(`data-tour="${s.target}"`), `data-tour="${s.target}" 가 없음`)
    }
  })

  test('화면에 안 보이는 요소의 단계는 건너뜀 (예: 모바일에서 다크 모드 줄)', () => {
    const shown = visibleSteps(GUIDE_STEPS, (t) => t !== 'mode')
    assert.equal(shown.length, GUIDE_STEPS.length - 1)
    assert.ok(!shown.some((s) => s.target === 'mode'))
    assert.deepEqual(
      visibleSteps(GUIDE_STEPS, () => false).map((s) => s.target),
      [undefined, undefined],
    )
  })
})

describe('문구 강조 (**…**)', () => {
  test('강조 부분만 나눠서 표시', () => {
    assert.deepEqual(splitEmphasis('매일 **코인**과 **액세서리** 선물'), [
      { text: '매일 ', strong: false },
      { text: '코인', strong: true },
      { text: '과 ', strong: false },
      { text: '액세서리', strong: true },
      { text: ' 선물', strong: false },
    ])
    assert.deepEqual(splitEmphasis('강조 없음'), [{ text: '강조 없음', strong: false }])
    assert.deepEqual(splitEmphasis('**처음**부터'), [
      { text: '처음', strong: true },
      { text: '부터', strong: false },
    ])
  })

  test('마지막 안내에서 코인과 액세서리를 강조', () => {
    const strong = splitEmphasis(GUIDE_STEPS[GUIDE_STEPS.length - 1].body).filter((p) => p.strong)
    assert.deepEqual(
      strong.map((p) => p.text),
      ['코인', '액세서리'],
    )
  })

  test('모든 문구의 별표 짝이 맞음 (화면에 ** 가 그대로 보이지 않게)', () => {
    for (const s of GUIDE_STEPS) assert.ok(!splitEmphasis(s.body).some((p) => p.text.includes('*')), s.title)
  })
})

describe('위치 계산', () => {
  const { pad, gap, margin, cardWidth } = GUIDE_LAYOUT
  const vw = 1280
  const vh = 800

  test('강조 영역은 요소보다 여백만큼 넓음', () => {
    assert.deepEqual(spotlightBox({ top: 100, left: 50, width: 200, height: 40 }), {
      top: 100 - pad,
      left: 50 - pad,
      width: 200 + pad * 2,
      height: 40 + pad * 2,
    })
  })

  test('강조할 요소가 없으면 화면 가운데', () => {
    assert.deepEqual(placeCard(null, 200, vw, vh), { top: 300, left: (vw - cardWidth) / 2, width: cardWidth })
  })

  test('아래에 자리가 있으면 아래, 가로는 강조 영역 가운데', () => {
    const box = { top: 100, left: 500, width: 200, height: 100 }
    assert.deepEqual(placeCard(box, 200, vw, vh), { top: 200 + gap, left: 600 - cardWidth / 2, width: cardWidth })
  })

  test('아래에 자리가 없으면 위', () => {
    const box = { top: 500, left: 500, width: 200, height: 200 }
    assert.equal(placeCard(box, 200, vw, vh).top, 500 - gap - 200)
  })

  test('위아래 모두 자리가 없으면 화면 아래쪽 (큰 카드 영역 등)', () => {
    const box = { top: 100, left: 0, width: 600, height: 600 }
    assert.equal(placeCard(box, 200, vw, vh).top, vh - 200 - margin)
  })

  test('화면 가장자리 밖으로 나가지 않음', () => {
    assert.equal(placeCard({ top: 100, left: 0, width: 40, height: 40 }, 200, vw, vh).left, margin)
    assert.equal(placeCard({ top: 100, left: vw - 40, width: 40, height: 40 }, 200, vw, vh).left, vw - cardWidth - margin)
  })

  test('동물 친구가 나오는 인사 카드는 더 넓게 (가운데)', () => {
    const { heroWidth } = GUIDE_LAYOUT
    assert.deepEqual(placeCard(null, 400, vw, vh, heroWidth), { top: 200, left: (vw - heroWidth) / 2, width: heroWidth })
    assert.equal(placeCard(null, 400, 360, 700, heroWidth).width, 360 - margin * 2)
  })

  test('좁은 화면에서는 카드가 화면 너비에 맞춰짐', () => {
    const narrow = placeCard({ top: 100, left: 20, width: 300, height: 60 }, 200, 360, 700)
    assert.equal(narrow.width, 360 - margin * 2)
    assert.equal(narrow.left, margin)
  })
})
