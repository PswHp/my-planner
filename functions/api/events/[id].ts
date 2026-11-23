import { deleteRow, getOwned, pick, updateRow } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson } from '../../_lib/http'
import { assertRange, eventResource } from '../../_lib/resources'

export const onRequestPatch: Handler<'id'> = async ({ env, request, data, params }) => {
  const id = params.id as string
  const values = pick(eventResource, await readJson(request), true)
  const current = await getOwned(env.DB, 'events', data.user.id, id)
  assertRange(values.start_at ?? current.start_at, values.end_at ?? current.end_at)
  return json(await updateRow(env.DB, eventResource, data.user.id, id, values))
}

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  await deleteRow(env.DB, 'events', data.user.id, params.id as string)
  return json({ ok: true })
}
