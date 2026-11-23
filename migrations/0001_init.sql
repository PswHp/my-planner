-- 날짜/시간은 사용자 로컬 기준 문자열로 저장합니다.
-- 날짜: 'YYYY-MM-DD', 일시: 'YYYY-MM-DDTHH:mm'

CREATE TABLE users (
  id         TEXT PRIMARY KEY,          -- Google sub
  email      TEXT NOT NULL,
  name       TEXT,
  picture    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,          -- 세션 토큰의 SHA-256 해시
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL           -- unix ms
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_at    TEXT NOT NULL,
  end_at      TEXT NOT NULL,
  all_day     INTEGER NOT NULL DEFAULT 0,
  color       TEXT NOT NULL DEFAULT 'blue',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_user_start ON events(user_id, start_at);

CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  notes        TEXT NOT NULL DEFAULT '',
  due_date     TEXT,
  priority     INTEGER NOT NULL DEFAULT 0,   -- 0 없음, 1 낮음, 2 보통, 3 높음
  done         INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_tasks_user ON tasks(user_id, done, due_date);

CREATE TABLE time_blocks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  start_min  INTEGER NOT NULL,              -- 자정 기준 분 (0~1440)
  end_min    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'work',
  task_id    TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_blocks_user_date ON time_blocks(user_id, date);
