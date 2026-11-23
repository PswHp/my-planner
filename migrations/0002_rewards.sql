-- 일일 접속 보상 (기존 테이블 · 데이터는 변경하지 않고 추가만 합니다)

-- 보유 코인 (기존 사용자는 0부터)
ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT 0;

-- 날짜별 보상 수령 기록 — (사용자, 한국 날짜)가 고유하므로 하루 1회만 저장됩니다.
CREATE TABLE daily_rewards (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_date  TEXT NOT NULL,              -- 'YYYY-MM-DD' (Asia/Seoul)
  claim_id     TEXT NOT NULL UNIQUE,       -- 이 기록을 만든 요청의 무작위 ID (같은 요청의 후속 처리 연결용)
  accessory_id TEXT NOT NULL,
  rarity       TEXT NOT NULL,              -- N / R / SR / SSR
  duplicate    INTEGER NOT NULL,           -- 1 = 이미 보유해서 코인으로 전환됨
  coins        INTEGER NOT NULL,           -- 이날 받은 코인 합계 (기본 + 중복 보너스)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, reward_date)
);

-- 보유 액세서리 — 같은 액세서리는 한 번만 저장됩니다.
CREATE TABLE user_accessories (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accessory_id TEXT NOT NULL,
  acquired_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, accessory_id)
);
