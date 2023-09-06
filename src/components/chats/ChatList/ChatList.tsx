import useInfiniteScrollData from '@/components/chats/ChatList/hooks/useInfiniteScrollData'
import Container from '@/components/Container'
import ScrollableContainer from '@/components/ScrollableContainer'
import { CHAT_PER_PAGE } from '@/constants/chat'
import useFilterBlockedMessageIds from '@/hooks/useFilterBlockedMessageIds'
import { useConfigContext } from '@/providers/ConfigProvider'
import { getPostQuery } from '@/services/api/query'
import { useCommentIdsByPostId } from '@/services/subsocial/commentIds'
import { useMyAccount } from '@/stores/my-account'
import { cx } from '@/utils/class-names'
import { sendMessageToParentWindow } from '@/utils/window'
import {
  ComponentProps,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import CenterChatNotice from './CenterChatNotice'
import MemoizedChatItemWrapper from './ChatItemWithMenu'
import ChatListSupportingContent from './ChatListSupportingContent'
import ChatLoading from './ChatLoading'
import ChatTopNotice from './ChatTopNotice'
import useFocusedLastMessageId from './hooks/useFocusedLastMessageId'
import useLoadMoreIfNoScroll from './hooks/useLoadMoreIfNoScroll'
import useScrollToMessage from './hooks/useScrollToMessage'
import PinnedMessage from './PinnedMessage'

export type ChatListProps = ComponentProps<'div'> & {
  asContainer?: boolean
  scrollContainerRef?: React.RefObject<HTMLDivElement>
  scrollableContainerClassName?: string
  hubId: string
  chatId: string
  newMessageNoticeClassName?: string
}

export default function ChatList(props: ChatListProps) {
  const isInitialized = useMyAccount((state) => state.isInitialized)
  if (!isInitialized) return null
  return <ChatListContent key={props.chatId} {...props} />
}

const SCROLL_THRESHOLD = 1000

function ChatListContent({
  asContainer,
  scrollableContainerClassName,
  hubId,
  chatId,
  scrollContainerRef: _scrollContainerRef,
  newMessageNoticeClassName,
  ...props
}: ChatListProps) {
  const { enableBackButton } = useConfigContext()
  const lastReadId = useFocusedLastMessageId(chatId)

  const scrollableContainerId = useId()

  const innerScrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = _scrollContainerRef || innerScrollContainerRef

  const innerRef = useRef<HTMLDivElement>(null)

  const { data: rawMessageIds } = useCommentIdsByPostId(chatId, {
    subscribe: true,
  })
  const messageIds = rawMessageIds || []

  const [isPausedLoadMore, setIsPausedLoadMore] = useState(false)
  const { currentData: currentPageMessageIds, loadMore } =
    useInfiniteScrollData(messageIds, CHAT_PER_PAGE, isPausedLoadMore)

  const filteredMessageIds = useFilterBlockedMessageIds(
    hubId,
    chatId,
    messageIds
  )
  const filteredCurrentPageIds = useFilterBlockedMessageIds(
    hubId,
    chatId,
    currentPageMessageIds
  )

  useEffect(() => {
    sendMessageToParentWindow(
      'totalMessage',
      (filteredMessageIds.length ?? 0).toString()
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const messageQueries = getPostQuery.useQueries(filteredCurrentPageIds)
  const loadedMessageQueries = useMemo(() => {
    return messageQueries.filter((message) => message.isLoading === false)
  }, [messageQueries])

  useLoadMoreIfNoScroll(loadMore, loadedMessageQueries?.length ?? 0, {
    scrollContainer: scrollContainerRef,
    innerContainer: innerRef,
  })

  const scrollToMessage = useScrollToMessage(
    scrollContainerRef,
    {
      messageIds: currentPageMessageIds,
      messageQueries,
      loadedMessageQueries,
      loadMore,
    },
    {
      pause: () => setIsPausedLoadMore(true),
      unpause: () => setIsPausedLoadMore(false),
    }
  )

  const myAddress = useMyAccount((state) => state.address)
  const { data: chat } = getPostQuery.useQuery(chatId)
  const isMyChat = chat?.struct.ownerId === myAddress

  const Component = asContainer ? Container<'div'> : 'div'

  const isAllMessagesLoaded =
    loadedMessageQueries.length === filteredMessageIds.length

  return (
    <div
      {...props}
      className={cx(
        'relative flex flex-1 flex-col overflow-hidden',
        props.className
      )}
    >
      <PinnedMessage
        scrollToMessage={scrollToMessage}
        chatId={chatId}
        asContainer={asContainer}
      />
      {messageIds.length === 0 && (
        <CenterChatNotice
          isMyChat={isMyChat}
          className='absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2'
        />
      )}
      <ScrollableContainer
        id={scrollableContainerId}
        ref={scrollContainerRef}
        className={cx(
          'flex flex-col-reverse overflow-x-hidden overflow-y-scroll pl-2',
          scrollableContainerClassName
        )}
      >
        <Component
          ref={innerRef}
          className={cx(enableBackButton === false && 'px-0')}
        >
          <InfiniteScroll
            dataLength={loadedMessageQueries.length}
            next={loadMore}
            className={cx(
              'relative flex flex-col-reverse gap-2 !overflow-hidden pb-2',
              // need to have enough room to open message menu
              'min-h-[400px]'
            )}
            hasMore={!isAllMessagesLoaded}
            inverse
            scrollableTarget={scrollableContainerId}
            loader={<ChatLoading className='pb-2 pt-4' />}
            endMessage={
              messageQueries.length === 0 ? null : (
                <ChatTopNotice className='pb-2 pt-4' />
              )
            }
            scrollThreshold={`${SCROLL_THRESHOLD}px`}
          >
            {messageQueries.map(({ data: message }, index) => {
              // bottom message is the first element, because the flex direction is reversed
              const isBottomMessage = index === 0
              return (
                <MemoizedChatItemWrapper
                  key={message?.id ?? index}
                  chatId={chatId}
                  hubId={hubId}
                  isBottomMessage={isBottomMessage}
                  message={message}
                  scrollToMessage={scrollToMessage}
                  lastReadId={lastReadId}
                />
              )
            })}
          </InfiniteScroll>
        </Component>
      </ScrollableContainer>

      <ChatListSupportingContent
        chatId={chatId}
        hubId={hubId}
        filteredMessageIds={filteredMessageIds}
        loadedMessageQueries={loadedMessageQueries}
        rawMessageIds={rawMessageIds}
        scrollContainerRef={scrollContainerRef}
        scrollToMessage={scrollToMessage}
        asContainer={asContainer}
        newMessageNoticeClassName={newMessageNoticeClassName}
      />
    </div>
  )
}
