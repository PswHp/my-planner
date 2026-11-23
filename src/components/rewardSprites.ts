/**
 * ⚠️ 임시 리소스 — 일일 보상 화면의 그림(선물 상자 · 코인 · 액세서리)을 코드로 그린 픽셀 아트입니다.
 * 정식 일러스트가 준비되면 이 파일의 스프라이트만 교체하면 됩니다.
 * 액세서리 키는 서버 설정(functions/_lib/rewards.ts)의 액세서리 id와 같아야 합니다.
 */
type Sprite = { rows: string[]; palette: Record<string, string> }

const GIFT_ROWS = [
  '....rr..rr....',
  '...r..rr..r...',
  '....rrrrrr....',
  '.oooooooooooo.',
  '.oLLLLrrLLLLo.',
  '.oLLLLrrLLLLo.',
  '.oooooooooooo.',
  '..oDDDrrDDDo..',
  '..oDDDrrDDDo..',
  '..oDDDrrDDDo..',
  '..oDDDrrDDDo..',
  '..oooooooooo..',
]

/** 선물 상자 — 블루 · 오렌지 · 퍼플 */
export const GIFTS: Sprite[] = [
  { rows: GIFT_ROWS, palette: { o: '#5d7f9c', L: '#b7cfe2', D: '#8dabc4', r: '#f3d27a' } },
  { rows: GIFT_ROWS, palette: { o: '#b9824a', L: '#f3d1a8', D: '#e7b782', r: '#d86a6a' } },
  { rows: GIFT_ROWS, palette: { o: '#7a5fa0', L: '#cdb8e3', D: '#a88cc6', r: '#f3d27a' } },
]

export const COIN: Sprite = {
  palette: { o: '#c9902a', y: '#f3c24f', Y: '#fbe39a' },
  rows: ['..oooo..', '.oyyyyo.', 'oyYyyyyo', 'oyYyyyyo', 'oyYyyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'],
}

export const ACCESSORY_SPRITES: Record<string, Sprite> = {
  ribbon_red: {
    palette: { r: '#b83a3a', R: '#e66464', k: '#c94b4b' },
    rows: ['.rr......rr.', 'rRRr....rRRr', 'rRRRr..rRRRr', 'rRRRRkkRRRRr', 'rRRRRkkRRRRr', 'rRRRr..rRRRr', 'rRRr....rRRr', '.rr......rr.'],
  },
  glasses_round: {
    palette: { o: '#4a3b36', g: '#dceaf5', w: '#ffffff' },
    rows: ['..oooo....oooo..', '.oggggo..oggggo.', 'ogwgggoooogwgggo', 'ogggggo..ogggggo', '.oggggo..oggggo.', '..oooo....oooo..'],
  },
  sprout_pin: {
    palette: { L: '#8fca7a', l: '#b5e0a0', g: '#5f9f58', o: '#b0893a', y: '#f3d27a' },
    rows: ['.LL...LL.', 'LlLL.LLlL', '.LLLgLLL.', '....g....', '....g....', '..ooooo..', '..oyyyo..', '..ooooo..'],
  },
  scarf_pink: {
    palette: { o: '#c76b82', P: '#f4a7b6', p: '#fbd3dc' },
    rows: [
      '.oooooooooooo.',
      'oPpPPpPPpPPpPo',
      'oPPPPPPPPPPPPo',
      '.ooooPPPooooo.',
      '....oPpPo.....',
      '....oPPPo.....',
      '....oPpPo.....',
      '....ooooo.....',
    ],
  },
  cap_orange: {
    palette: { o: '#9a6324', O: '#e7b782', w: '#f6dcb8', D: '#c98b4a', B: '#d9a066' },
    rows: [
      '.....oooo.....',
      '...ooOOOOoo...',
      '..oOOwwOOOOo..',
      '.oOOOOOOOOOOo.',
      '.oOOOOOOOOOOo.',
      '.oDDDDDDDDDDo.',
      'oBBBBBBBBBBBBo',
      '.oooooooooooo.',
    ],
  },
  ear_ribbon: {
    palette: { o: '#5a4640', W: '#ffffff', P: '#f4a7b6', r: '#e66464' },
    rows: ['.oo..........oo.', 'oWWo........oWWo', 'oWPWo......oWPWo', 'oWPPWo.rr.oWPPWo', 'oWWWWWorrroWWWWo', '.oooooooooooooo.'],
  },
  crown_gold: {
    palette: { o: '#b07d1e', Y: '#f6cd5a', r: '#e66464', b: '#6f97bd' },
    rows: [
      'o.....oo.....o',
      'oo...oYYo...oo',
      'oYo.oYYYYo.oYo',
      'oYYoYYYYYYoYYo',
      'oYYYYYYYYYYYYo',
      'oYYrYYbYYrYYYo',
      'oYYYYYYYYYYYYo',
      'oooooooooooooo',
    ],
  },
}

/** 목록에 없는 액세서리(서버에 새로 추가했지만 그림이 아직 없는 경우)용 */
export const UNKNOWN_ACCESSORY: Sprite = GIFTS[2]
