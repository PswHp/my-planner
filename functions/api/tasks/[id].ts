import { deleteRow, pick, updateRow } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { HttpError, json, readJson } from '../../_lib/http'
import { taskResource } from '../../_lib/resources'

export const onRequestPatch: Handler<'id'> = async ({ env, request, data, params }) => {
  const values = pick(taskResource, await readJson(request), true)
  delete values.created_at
  if (values.done === 0) values.completed_at = null
  if (values.done === 1 && !values.completed_at)
    throw new HttpError(400, 'completed_at: 완료 처리 시 완료 시각(로컬)을 함께 보내야 합니다.')
  return json(await updateRow(env.DB, taskResource, data.user.id, params.id as string, values))
}

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  await deleteRow(env.DB, 'tasks', data.user.id, params.id as string)
  return json({ ok: true })
}
