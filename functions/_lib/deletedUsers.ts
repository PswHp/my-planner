/**
 * 탈퇴 기록 (deleted_users) — 장애 복구로 DB를 되돌린 뒤 그 사이 탈퇴한 사용자를 다시 지우는 데 씁니다.
 * 원래 ID 대신 SHA-256 값만 남기고, DELETED_LOG_DAYS 가 지나면 지웁니다. (개인정보처리방침 제3조)
 */
import { sha256 } from './auth'

export const DELETED_LOG_DAYS = 30

/** 탈퇴 기록 남기기 (다시 가입했다가 또 탈퇴하면 시각만 갱신) */
export const logDeletedUser = async (db: D1Database, userId: string) =>
  db
    .prepare(
      `INSERT INTO deleted_users (id_hash, deleted_at) VALUES (?, datetime('now'))
       ON CONFLICT(id_hash) DO UPDATE SET deleted_at = excluded.deleted_at`,
    )
    .bind(await sha256(userId))

/** 보관 기간이 지난 탈퇴 기록 지우기 */
export const purgeDeletedUsers = (db: D1Database) =>
  db.prepare(`DELETE FROM deleted_users WHERE deleted_at < datetime('now', ?)`).bind(`-${DELETED_LOG_DAYS} days`)
