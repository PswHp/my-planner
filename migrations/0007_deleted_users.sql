-- 탈퇴 기록 — DB를 이전 시점으로 되돌렸을 때(장애 복구) 그 사이에 탈퇴한 사용자를 다시 지우기 위해 씁니다.
-- id_hash: users.id 의 SHA-256 (16진수, 원래 ID는 저장하지 않음) / deleted_at: 탈퇴 시각 (UTC, users.created_at 과 같은 형식)
-- 30일이 지난 기록은 자동으로 지웁니다. 복구 절차는 scripts/restore-guard.ts 참고.
CREATE TABLE deleted_users (
  id_hash    TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL
);
CREATE INDEX idx_deleted_users_at ON deleted_users(deleted_at);
