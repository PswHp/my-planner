export interface Env {
  DB: D1Database
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  ALLOWED_EMAILS?: string
  APP_URL?: string
}

export interface User {
  id: string
  email: string
  name: string | null
  picture: string | null
}

export interface Data extends Record<string, unknown> {
  user: User
}

export type Handler<P extends string = never> = PagesFunction<Env, P, Data>
