import ChatPreview from '@/components/chats/ChatPreview'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import { getPostQuery } from '@/services/api/query'
import { getPostIdsBySpaceIdQuery } from '@/services/subsocial/posts'
import { useSendEvent } from '@/stores/analytics'
import { getSpaceId } from '@/utils/env/client'
import { getIpfsContentUrl } from '@/utils/ipfs'
import { createPostSlug } from '@subsocial/utils/slugify'
import dynamic from 'next/dynamic'

const WelcomeModal = dynamic(() => import('./WelcomeModal'), { ssr: false })

export default function HomePage() {
  const { data } = getPostIdsBySpaceIdQuery.useQuery(getSpaceId())

  return (
    <DefaultLayout>
      <WelcomeModal />
      <div className='flex flex-col'>
        {(data?.postIds ?? []).map((postId) => (
          <ChatPreviewContainer postId={postId} key={postId} />
        ))}
      </div>
    </DefaultLayout>
  )
}

function ChatPreviewContainer({ postId }: { postId: string }) {
  const { data } = getPostQuery.useQuery(postId)
  const sendEvent = useSendEvent()

  const content = data?.content

  const onChatClick = () =>
    sendEvent('Click on chat', {
      chatId: postId,
      name: content?.title ?? '',
    })

  return (
    <ChatPreview
      onClick={onChatClick}
      key={postId}
      asContainer
      asLink={{
        href: {
          pathname: '/chats/[topic]',
          query: {
            topic: createPostSlug(postId, { title: content?.title }),
          },
        },
      }}
      image={content?.image ? getIpfsContentUrl(content.image) : ''}
      title={content?.title ?? ''}
      description={content?.body ?? ''}
      postId={postId}
      withUnreadCount
    />
  )
}
