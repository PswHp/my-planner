-- 타임 블록 반복 묶음 — 일괄 추가한 블록들을 같은 series_id로 묶어 한꺼번에 수정 · 삭제
-- (기존 블록은 NULL = 묶음 없음, 영향 없음)
ALTER TABLE time_blocks ADD COLUMN series_id TEXT;
CREATE INDEX idx_blocks_series ON time_blocks(user_id, series_id);
