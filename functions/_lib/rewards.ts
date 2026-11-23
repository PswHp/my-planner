/**
 * 일일 접속 보상 설정 — 확률 · 코인 · 액세서리 목록은 이 파일에서만 바꾸면 됩니다.
 * (추첨은 서버에서만 합니다. 브라우저는 결과만 받아서 보여줍니다.)
 */
export type Rarity = 'N' | 'R' | 'SR' | 'SSR'

export const REWARD_CONFIG = {
  /** 매일 기본 지급 코인 */
  baseCoins: 10,
  /** 등급별 당첨 확률 (합계는 1이 아니어도 됨 — 비율로 계산) */
  rarityWeights: { N: 60, R: 28, SR: 10, SSR: 2 } as Record<Rarity, number>,
  /** 이미 보유한 액세서리를 다시 뽑았을 때 대신 주는 추가 코인 */
  duplicateCoins: { N: 5, R: 10, SR: 25, SSR: 50 } as Record<Rarity, number>,
  /** 기준 시간대 (날짜가 바뀌는 기준) */
  timeZone: 'Asia/Seoul',
}

export interface Accessory {
  id: string
  name: string
  rarity: Rarity
  description: string
}

/** 액세서리 목록 — id는 화면의 그림(스프라이트)과 연결되므로 바꾸지 마세요. 추가는 자유롭게. */
export const ACCESSORIES: Accessory[] = [
  { id: 'ribbon_red', name: '빨간 리본', rarity: 'N', description: '어디에 달아도 잘 어울리는 작은 리본이에요.' },
  { id: 'glasses_round', name: '동그란 안경', rarity: 'N', description: '똑똑해 보이는 동그란 안경이에요.' },
  { id: 'sprout_pin', name: '새싹 핀', rarity: 'N', description: '머리 위에 새싹이 쏙! 오늘도 자라는 중이에요.' },
  { id: 'scarf_pink', name: '분홍 목도리', rarity: 'R', description: '포근하게 감싸주는 분홍 목도리예요.' },
  { id: 'cap_orange', name: '주황 모자', rarity: 'R', description: '햇살 좋은 날 쓰기 좋은 모자예요.' },
  { id: 'ear_ribbon', name: '리본 고양이 귀', rarity: 'SR', description: '귀여운 리본이 달린 고양이 귀예요.' },
  { id: 'crown_gold', name: '반짝 왕관', rarity: 'SSR', description: '아주 드물게 나타나는 반짝이는 왕관이에요.' },
]

/** 지금 시각의 기준 시간대 날짜 'YYYY-MM-DD' */
export function rewardDate(now = new Date()): string {
  // en-CA 형식은 YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REWARD_CONFIG.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** 0 이상 1 미만의 암호학적 난수 */
function random(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
}

/** 등급을 가중치로 뽑고, 그 등급의 액세서리 중 하나를 고름 */
export function drawAccessory(): Accessory {
  const weights = Object.entries(REWARD_CONFIG.rarityWeights).filter(([r, w]) => w > 0 && ACCESSORIES.some((a) => a.rarity === r)) as [
    Rarity,
    number,
  ][]
  const total = weights.reduce((s, [, w]) => s + w, 0)
  let roll = random() * total
  let rarity = weights[weights.length - 1][0]
  for (const [r, w] of weights) {
    if (roll < w) {
      rarity = r
      break
    }
    roll -= w
  }
  const pool = ACCESSORIES.filter((a) => a.rarity === rarity)
  return pool[Math.floor(random() * pool.length)]
}

export const findAccessory = (id: string) => ACCESSORIES.find((a) => a.id === id)
