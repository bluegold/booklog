export type BookMetadata = {
  title: string
  author: string
  publisher: string
}

type OpenBdSummary = {
  title?: string
  author?: string
  publisher?: string
}

type OpenBdItem = {
  summary?: OpenBdSummary
} | null

const OPENBD_URL = 'https://api.openbd.jp/v1/get'

export const fetchBookMetadataFromOpenBd = async (isbn: string): Promise<BookMetadata | null> => {
  const url = `${OPENBD_URL}?isbn=${encodeURIComponent(isbn)}`
  const res = await fetch(url)

  if (!res.ok) {
    return null
  }

  const data: OpenBdItem[] = await res.json()
  const item = data[0]

  if (!item?.summary) {
    return null
  }

  const { title, author, publisher } = item.summary

  if (!title) {
    return null
  }

  return {
    title,
    author: author ?? '',
    publisher: publisher ?? '',
  }
}
