import { appOrigin, cookieName, isSecure, userFromSession } from '../_lib/auth'
import type { Handler } from '../_lib/env'
import { error, getCookie, HttpError } from '../_lib/http'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** API 응답 공통 보안 헤더 */
function harden(res: Response): Response {
  const out = new Response(res.body, res)
  out.headers.set('cache-control', 'no-store')
  out.headers.set('x-content-type-options', 'nosniff')
  out.headers.set('x-frame-options', 'DENY')
  out.headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  return out
}

/**
 * /api/* 전체:
 *  1) 상태 변경 요청(POST/PATCH/DELETE)은 Origin 헤더가 이 사이트일 때만 허용 (CSRF 방어)
 *  2) /api/auth/* 를 제외하고 로그인 세션 확인
 *  3) 에러 처리 및 보안 헤더
 */
export const onRequest: Handler = async (ctx) => {
  try {
    const { request, env } = ctx
    if (!SAFE_METHODS.has(request.method)) {
      const origin = request.headers.get('origin')
      if (origin !== appOrigin(env, request)) return harden(error(403, '허용되지 않은 요청 출처입니다.'))
    }

    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/api/auth/')) {
      const token = getCookie(request, cookieName('sid', isSecure(env, request)))
      const user = await userFromSession(env, token)
      if (!user) return harden(error(401, '로그인이 필요합니다.'))
      ctx.data.user = user
    }
    return harden(await ctx.next())
  } catch (e) {
    if (e instanceof HttpError) return harden(error(e.status, e.message))
    console.error(e)
    return harden(error(500, '서버 오류가 발생했습니다.'))
  }
}
