import ImageAdd from '@/assets/icons/image-add.svg'
import AutofocusWrapper from '@/components/AutofocusWrapper'
import Button from '@/components/Button'
import { ChatFormProps } from '@/components/chats/ChatForm'
import ErrorPanel from '@/components/ErrorPanel'
import TextArea from '@/components/inputs/TextArea'
import MediaLoader, { MediaLoaderProps } from '@/components/MediaLoader'
import { ModalFunctionalityProps } from '@/components/modals/Modal'
import Spinner from '@/components/Spinner'
import useDebounce from '@/hooks/useDebounce'
import { useSaveImage } from '@/services/api/mutations'
import { cx } from '@/utils/class-names'
import { resizeImage } from '@/utils/image'
import { ImageExtension } from '@subsocial/api/types'
import React, { useEffect, useState } from 'react'
import Dropzone from 'react-dropzone'
import { HiTrash } from 'react-icons/hi2'
import { z } from 'zod'
import CommonExtensionModal from '../CommonExtensionModal'

export type ImageAttachmentModalProps = ModalFunctionalityProps &
  Pick<ChatFormProps, 'chatId'>

const urlSchema = z.string().url('Please enter a valid URL.')

type ImageStatus = {
  loadedLink: string | null
  isShowingImage: boolean
}
export default function ImageAttachmentModal(props: ImageAttachmentModalProps) {
  const { chatId, ...otherProps } = props

  const [imageLinkStatus, setImageLinkStatus] = useState<ImageStatus>({
    isShowingImage: false,
    loadedLink: null,
  })
  const [imageUploadStatus, setImageUploadStatus] = useState<ImageStatus>({
    isShowingImage: false,
    loadedLink: null,
  })

  const isAnyShowingImage =
    imageLinkStatus.isShowingImage || imageUploadStatus.isShowingImage

  const generateAdditionalTxParams = async () => {
    let imageUrl: string | null = ''
    if (imageUploadStatus) {
      imageUrl = imageUploadStatus.loadedLink
    } else {
      imageUrl = imageLinkStatus.loadedLink
    }

    if (!imageUrl) return {}

    return {
      extensions: [
        {
          id: 'subsocial-image',
          properties: {
            image: imageUrl,
          },
        } as ImageExtension,
      ],
    }
  }

  return (
    <>
      <CommonExtensionModal
        {...otherProps}
        size='md'
        mustHaveMessageBody={false}
        chatId={chatId}
        disableSendButton={!isAnyShowingImage}
        title='🖼 Image'
        buildAdditionalTxParams={generateAdditionalTxParams}
      >
        <div className='mt-2 flex flex-col gap-4'>
          {!imageUploadStatus.isShowingImage && (
            <ImageLinkInput setImageLinkStatus={setImageLinkStatus} />
          )}

          {!isAnyShowingImage && (
            <div className='relative my-2 flex items-center justify-center'>
              <div className='absolute top-1/2 h-px w-full bg-border-gray' />
              <span className='relative bg-background-light px-3 text-xs text-text-muted'>
                OR
              </span>
            </div>
          )}

          {!imageLinkStatus.isShowingImage && (
            <ImageUpload setUploadedImageLink={setImageUploadStatus} />
          )}
        </div>
      </CommonExtensionModal>
    </>
  )
}

type ImageLinkInputProps = {
  setImageLinkStatus: React.Dispatch<React.SetStateAction<ImageStatus>>
}
function ImageLinkInput({ setImageLinkStatus }: ImageLinkInputProps) {
  const [imageLink, setImageLink] = useState('')
  const [isImageLinkError, setIsImageLinkError] = useState(false)

  const debouncedImageLink = useDebounce(imageLink, 300)
  const isValidDebouncedImageLink =
    urlSchema.safeParse(debouncedImageLink).success

  useEffect(() => {
    setIsImageLinkError(false)
    setImageLinkStatus((prev) => {
      if (prev.isShowingImage) {
        return {
          loadedLink: '',
          isShowingImage: false,
        }
      }
      return prev
    })
  }, [imageLink, setImageLinkStatus])

  const onImageLinkError = () => {
    if (imageLink !== debouncedImageLink) return
    setIsImageLinkError(true)
  }

  const shouldShowImage =
    isValidDebouncedImageLink && !!imageLink && !isImageLinkError

  useEffect(() => {
    setImageLinkStatus((prev) => ({
      ...prev,
      isShowingImage: shouldShowImage,
    }))
  }, [setImageLinkStatus, shouldShowImage])

  return (
    <>
      <AutofocusWrapper>
        {({ ref }) => (
          <TextArea
            value={imageLink}
            onChange={(e) => setImageLink(e.target.value)}
            size='sm'
            rows={1}
            ref={ref}
            placeholder='Paste NFT URL'
            error={!!isImageLinkError}
          />
        )}
      </AutofocusWrapper>
      {isImageLinkError && (
        <ErrorPanel>😥 Sorry, we cannot parse this URL.</ErrorPanel>
      )}
      {shouldShowImage && (
        <ImageLoader
          clearImage={() => setImageLink('')}
          src={debouncedImageLink}
          onError={onImageLinkError}
          onLoad={() =>
            setImageLinkStatus({
              loadedLink: debouncedImageLink,
              isShowingImage: true,
            })
          }
        />
      )}
    </>
  )
}

type ImageUploadProps = {
  setUploadedImageLink: React.Dispatch<React.SetStateAction<ImageStatus>>
}
function ImageUpload({ setUploadedImageLink }: ImageUploadProps) {
  const [imageUrl, setImageUrl] = useState('')
  const {
    mutateAsync: saveImage,
    isError,
    isLoading,
  } = useSaveImage({
    onSuccess: (res) => {
      const { cid } = res
      setImageUrl(`ipfs://${cid}`)
    },
  })

  useEffect(() => {
    const isShowingImage = (!!imageUrl || isLoading) && !isError
    console.log(isShowingImage, imageUrl, isLoading, isError)
    setUploadedImageLink({ isShowingImage, loadedLink: null })
  }, [setUploadedImageLink, imageUrl, isLoading, isError])

  if (imageUrl) {
    return (
      <ImageLoader
        clearImage={() => setImageUrl('')}
        src={imageUrl}
        onLoad={() =>
          setUploadedImageLink((prev) => ({ ...prev, loadedLink: imageUrl }))
        }
      />
    )
  }

  const onImageChosen = async (files: File[]) => {
    const image = files[0] ?? null
    const resizedImage = await resizeImage(image)
    saveImage(resizedImage)
  }

  return (
    <>
      <Dropzone
        multiple={false}
        accept={{ 'image/*': ['.png', '.gif', '.jpeg', '.jpg', '.svg'] }}
        onDrop={onImageChosen}
      >
        {({ getRootProps, getInputProps }) => (
          <div
            {...getRootProps()}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-background-primary p-8 text-center',
              isError && 'border-text-red'
            )}
          >
            <input {...getInputProps()} />
            <div className='mb-3 text-3xl'>
              {isLoading ? <Spinner className='h-8 w-8' /> : <ImageAdd />}
            </div>
            <p className='text-xl'>Drag image here</p>
            <p className='text-text-muted'>Or click to select</p>
          </div>
        )}
      </Dropzone>
      {isError && (
        <ErrorPanel>😥 Sorry, we cannot upload your image.</ErrorPanel>
      )}
    </>
  )
}

function ImageLoader({
  clearImage,
  ...props
}: MediaLoaderProps & { clearImage: () => void }) {
  return (
    <div className='relative overflow-hidden rounded-2xl'>
      <Button
        className='absolute right-4 top-4 z-20 bg-background-light text-xl text-text-red'
        size='circle'
        onClick={clearImage}
      >
        <HiTrash />
      </Button>
      <MediaLoader {...props} imageOnly />
    </div>
  )
}
