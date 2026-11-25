-- 할 일 반복 묶음 — 일괄 추가한 할 일들을 같은 series_id로 묶어 한꺼번에 수정 · 삭제
-- (기존 할 일은 NULL = 묶음 없음, 영향 없음)
ALTER TABLE tasks ADD COLUMN series_id TEXT;
CREATE INDEX idx_tasks_series ON tasks(user_id, series_id);
