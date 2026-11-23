import type { Handler } from '../_lib/env'
import { json } from '../_lib/http'

export const onRequestGet: Handler = async ({ data }) => json(data.user)
