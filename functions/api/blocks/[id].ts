import { deleteRow, getOwned, pick, updateRow } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson } from '../../_lib/http'
import { assertRange, blockResource } from '../../_lib/resources'

export const onRequestPatch: Handler<'id'> = async ({ env, request, data, params }) => {
  const id = params.id as string
  const values = pick(blockResource, await readJson(request), true)
  const current = await getOwned(env.DB, 'time_blocks', data.user.id, id)
  assertRange(values.start_min ?? current.start_min, values.end_min ?? current.end_min)
  if (values.task_id) await getOwned(env.DB, 'tasks', data.user.id, values.task_id as string)
  return json(await updateRow(env.DB, blockResource, data.user.id, id, values))
}

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  await deleteRow(env.DB, 'time_blocks', data.user.id, params.id as string)
  return json({ ok: true })
}
