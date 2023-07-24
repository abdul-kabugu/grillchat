import {
  ApiModerationActionsBody,
  ApiModerationActionsMessageParams,
  ApiModerationActionsMessageResponse,
  ApiModerationActionsResponse,
} from '@/pages/api/moderation/actions'
import mutationWrapper from '@/subsocial-query/base'
import axios from 'axios'
import { processMessageTpl } from '../utils'

async function commitModerationAction(data: ApiModerationActionsMessageParams) {
  if (!data) return null

  const res = await axios.get('/api/moderation/actions', { params: data })
  const messageTpl = (res.data as ApiModerationActionsMessageResponse)
    .messageTpl
  if (!messageTpl) throw new Error('Failed to do moderation action')

  const signedMessage = await processMessageTpl(messageTpl)

  const actionRes = await axios.post<
    any,
    ApiModerationActionsResponse,
    ApiModerationActionsBody
  >('/api/moderation/actions', { signedMessage })

  if (!actionRes.success) {
    throw new Error(actionRes.message)
  }
  return actionRes
}
export const useCommitModerationAction = mutationWrapper(commitModerationAction)
