/**
 * 처음 온 사람을 위한 사용법 안내 — '이 브라우저에서 봤는지'만 기억합니다.
 * - 저장: localStorage('dailumi:guide-seen'). 다른 기기 · 다른 브라우저 · 시크릿 창 · 사이트 데이터 삭제 후에는 다시 보입니다.
 * - 안내할 화면 요소에는 data-tour="이름" 을 달아 두고, 아래 단계의 target 으로 가리킵니다.
 *   화면에 보이지 않는 요소(예: 모바일에서 숨겨진 사이드바)를 가리키는 단계는 자동으로 건너뜁니다.
 */
const KEY = 'dailumi:guide-seen'

export function guideSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true // 저장소를 쓸 수 없으면 매번 띄우지 않음
  }
}

export function markGuideSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* 저장소 사용 불가 — 이번 화면에서만 닫힘 */
  }
}

export interface GuideStep {
  /** 강조할 요소의 data-tour 값 (없으면 화면 가운데 안내) */
  target?: string
  title: string
  body: string
  /** 화면 가운데에 동물 친구를 크게 보여주는 단계 (첫 인사) */
  hero?: boolean
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    hero: true,
    title: '데일루미에 오신 걸 환영해요!',
    body: '동물 친구와 함께하는 게임형 플래너예요. 주요 기능을 빠르게 둘러볼게요.',
  },
  {
    target: 'mode',
    title: '다크 모드',
    body: '줄을 아래로 당기면 밝은 화면과 어두운 화면이 바뀌어요.',
  },
  {
    target: 'quick-add',
    title: '어디서든 바로 추가',
    body: '화면 위의 + 추가 버튼으로 어느 화면에서든 일정이나 할 일을 바로 추가할 수 있어요.',
  },
  {
    target: 'today-tasks',
    title: '오늘의 할 일',
    body: '오늘이 마감인 할 일과 기한 없는 할 일을 한눈에 볼 수 있어요.',
  },
  {
    target: 'calendar',
    title: '달력',
    body: '날짜를 누르면 그날의 할 일과 일정을 볼 수 있어요. 점이 찍힌 날은 일정이나 할 일이 있는 날이에요.',
  },
  {
    target: 'schedule',
    title: '오늘의 일정',
    body: '선택한 날의 일정이에요. 누르면 바로 수정할 수 있어요.',
  },
  {
    target: 'pet',
    title: '나의 동물',
    body: '함께할 동물 친구예요. 키우기 · 꾸미기 기능은 곧 열려요.',
  },
  {
    target: 'nav',
    title: '메뉴',
    body: '일정 관리, 할 일 목록, 타임 블록, 통계 화면으로 이동할 수 있어요.',
  },
  {
    title: '준비 완료!',
    body: '매일 처음 접속하면 코인과 액세서리 선물을 받을 수 있어요. 오늘도 좋은 하루 보내세요!',
  },
]

/** 화면에 보이는 단계만 (target 이 없는 단계는 항상 포함) */
export const visibleSteps = (steps: GuideStep[], isVisible: (target: string) => boolean) =>
  steps.filter((s) => !s.target || isVisible(s.target))

export interface Box {
  top: number
  left: number
  width: number
  height: number
}

export const GUIDE_LAYOUT = {
  /** 강조 영역이 요소보다 넓은 만큼 */
  pad: 8,
  /** 강조 영역과 안내 카드 사이 */
  gap: 12,
  /** 화면 가장자리 여백 */
  margin: 16,
  /** 안내 카드 최대 너비 */
  cardWidth: 360,
  /** 동물 친구가 나오는 인사 카드 최대 너비 */
  heroWidth: 400,
}

/** 요소 위치 → 강조 영역 (여백만큼 넓힘) */
export function spotlightBox(r: Box): Box {
  const { pad } = GUIDE_LAYOUT
  return { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 }
}

/**
 * 안내 카드 위치
 * - 강조 영역이 없으면 화면 가운데
 * - 있으면 그 아래 → 자리가 없으면 위 → 둘 다 없으면 화면 아래쪽 (가로는 강조 영역 가운데, 화면 밖으로 안 나가게)
 */
export function placeCard(box: Box | null, cardH: number, vw: number, vh: number, maxWidth = GUIDE_LAYOUT.cardWidth) {
  const { gap, margin } = GUIDE_LAYOUT
  const width = Math.min(maxWidth, vw - margin * 2)
  if (!box) return { top: Math.max(margin, (vh - cardH) / 2), left: (vw - width) / 2, width }
  const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, margin), vw - width - margin)
  const below = box.top + box.height + gap
  const above = box.top - gap - cardH
  const top = below + cardH <= vh - margin ? below : above >= margin ? above : vh - cardH - margin
  return { top, left, width }
}
