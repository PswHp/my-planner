export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status)
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {
    /* fallthrough */
  }
  throw new HttpError(400, '요청 본문이 올바른 JSON 객체가 아닙니다.')
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export function setCookie(name: string, value: string, opts: { maxAge: number; secure: boolean }): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `Max-Age=${opts.maxAge}`, 'HttpOnly', 'SameSite=Lax']
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export function requireDate(value: string | null, name: string): string {
  if (!value || !DATE_RE.test(value)) throw new HttpError(400, `${name} 파라미터는 YYYY-MM-DD 형식이어야 합니다.`)
  return value
}
