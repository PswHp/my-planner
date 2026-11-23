import { randomToken } from '../../_lib/auth'
import type { Handler } from '../../_lib/env'
import { json } from '../../_lib/http'
import { drawAccessory, findAccessory, REWARD_CONFIG, rewardDate, type Rarity } from '../../_lib/rewards'

interface RewardRow {
  reward_date: string
  claim_id: string
  accessory_id: string
  rarity: Rarity
  duplicate: number
  coins: number
  total_coins: number
}

/**
 * POST /api/rewards/daily — 오늘(한국 시간)의 접속 보상 받기
 *
 * 한 번의 트랜잭션(D1 batch)으로 처리합니다.
 *  1) 오늘 기록 추가 — (사용자, 날짜) 고유 키라 이미 받았다면 아무 일도 일어나지 않음
 *  2) 1)에서 '이 요청이' 만든 기록일 때만 액세서리 추가 / 코인 지급 (claim_id로 연결)
 *  3) 오늘 기록을 읽어 반환 — 새로고침 · 연속 클릭으로 요청이 여러 번 와도 결과는 항상 같음
 */
export const onRequestPost: Handler = async ({ env, data }) => {
  const db = env.DB
  const uid = data.user.id
  const date = rewardDate()
  const claimId = randomToken(16)
  const pick = drawAccessory()

  const [, , , result] = await db.batch([
    db
      .prepare(
        `INSERT INTO daily_rewards (user_id, reward_date, claim_id, accessory_id, rarity, duplicate, coins)
         SELECT ?1, ?2, ?3, ?4, ?5, owned, ?6 + CASE WHEN owned THEN ?7 ELSE 0 END
           FROM (SELECT EXISTS(SELECT 1 FROM user_accessories WHERE user_id = ?1 AND accessory_id = ?4) AS owned)
          WHERE true
         ON CONFLICT (user_id, reward_date) DO NOTHING`,
      )
      .bind(uid, date, claimId, pick.id, pick.rarity, REWARD_CONFIG.baseCoins, REWARD_CONFIG.duplicateCoins[pick.rarity]),
    db
      .prepare(
        `INSERT OR IGNORE INTO user_accessories (user_id, accessory_id)
         SELECT user_id, accessory_id FROM daily_rewards WHERE claim_id = ?1 AND duplicate = 0`,
      )
      .bind(claimId),
    db
      .prepare(
        `UPDATE users SET coins = coins + (SELECT coins FROM daily_rewards WHERE claim_id = ?1)
          WHERE id = ?2 AND EXISTS (SELECT 1 FROM daily_rewards WHERE claim_id = ?1)`,
      )
      .bind(claimId, uid),
    db
      .prepare(
        `SELECT d.reward_date, d.claim_id, d.accessory_id, d.rarity, d.duplicate, d.coins, u.coins AS total_coins
           FROM daily_rewards d JOIN users u ON u.id = d.user_id
          WHERE d.user_id = ?1 AND d.reward_date = ?2`,
      )
      .bind(uid, date),
  ])

  const row = (result.results as unknown as RewardRow[])[0]
  const accessory = findAccessory(row.accessory_id) ?? {
    id: row.accessory_id,
    name: '알 수 없는 액세서리',
    rarity: row.rarity,
    description: '',
  }
  return json({
    date: row.reward_date,
    /** 이번 요청 전에 이미 받았던 보상이면 true (중복 요청) */
    alreadyClaimed: row.claim_id !== claimId,
    accessory: { ...accessory, rarity: row.rarity },
    duplicate: row.duplicate === 1,
    coins: row.coins,
    baseCoins: row.coins - (row.duplicate === 1 ? REWARD_CONFIG.duplicateCoins[row.rarity] : 0),
    totalCoins: row.total_coins,
  })
}
