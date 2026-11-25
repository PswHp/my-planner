-- 일정 ↔ 타임 블록 연결 — 일정을 만들면 블록이, 블록을 만들면 일정이 함께 생기고 서로 연결됩니다.
-- 일정을 지우면 연결된 블록도 함께 지워집니다. (기존 블록은 NULL = 연결 없음, 영향 없음)
ALTER TABLE time_blocks ADD COLUMN event_id TEXT REFERENCES events(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX idx_blocks_event ON time_blocks(event_id) WHERE event_id IS NOT NULL;
