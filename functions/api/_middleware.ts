import { SESSION_COOKIE, userFromSession } from '../_lib/auth'
import type { Handler } from '../_lib/env'
import { error, getCookie, HttpError } from '../_lib/http'

/** /api/* 전체: 에러 처리 + 로그인 확인 (/api/auth/* 는 제외) */
export const onRequest: Handler = async (ctx) => {
  try {
    const { pathname } = new URL(ctx.request.url)
    if (!pathname.startsWith('/api/auth/')) {
      const user = await userFromSession(ctx.env, getCookie(ctx.request, SESSION_COOKIE))
      if (!user) return error(401, '로그인이 필요합니다.')
      ctx.data.user = user
    }
    return await ctx.next()
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message)
    console.error(e)
    return error(500, '서버 오류가 발생했습니다.')
  }
}
