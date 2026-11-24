-- 반복 일정 묶음 — 일괄 추가한 일정들을 같은 series_id로 묶어 한꺼번에 수정 · 삭제
-- (기존 일정은 NULL = 묶음 없음, 영향 없음)
ALTER TABLE events ADD COLUMN series_id TEXT;
CREATE INDEX idx_events_series ON events(user_id, series_id);
