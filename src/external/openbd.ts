export type BookMetadata = {
  title: string
  author: string
  publisher: string
  published_at: string
  cover_url: string
}

type OpenBdSummary = {
  title?: string
  author?: string
  publisher?: string
  pubdate?: string
  cover?: string
}

type OpenBdItem = {
  summary?: OpenBdSummary
} | null

const OPENBD_URL = 'https://api.openbd.jp/v1/get'

const normalizePublishedAt = (pubdate: string | undefined): string => {
  if (!pubdate) {
    return ''
  }

  const digits = pubdate.replace(/\D/g, '')

  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }

  if (digits.length >= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`
  }

  if (digits.length >= 4) {
    return digits.slice(0, 4)
  }

  return pubdate
}

export const fetchBookMetadataFromOpenBd = async (isbn: string, debug = false): Promise<BookMetadata | null> => {
  const url = `${OPENBD_URL}?isbn=${encodeURIComponent(isbn)}`
  if (debug) {
    console.log('[openbd] request', { isbn, url })
  }
  const res = await fetch(url)
  if (debug) {
    console.log('[openbd] response', { isbn, status: res.status, ok: res.ok })
  }

  if (!res.ok) {
    if (debug) {
      console.warn('[openbd] non-ok response', { isbn, status: res.status })
    }
    return null
  }

  const data: OpenBdItem[] = await res.json()
  const item = data[0]

  if (!item && debug) {
    console.warn('[openbd] empty result', { isbn, dataLength: data.length })
  }

  if (!item?.summary) {
    if (debug) {
      console.warn('[openbd] summary missing', { isbn, hasItem: !!item })
    }
    return null
  }

  const { title, author, publisher, pubdate, cover } = item.summary
  if (debug) {
    console.log('[openbd] summary fields', {
      isbn,
      hasTitle: !!title,
      hasAuthor: !!author,
      hasPublisher: !!publisher,
      pubdate: pubdate ?? null,
      hasCover: !!cover,
      summaryKeys: Object.keys(item.summary),
    })
  }

  if (!title) {
    if (debug) {
      console.warn('[openbd] title missing', { isbn })
    }
    return null
  }

  const metadata = {
    title,
    author: author ?? '',
    publisher: publisher ?? '',
    published_at: normalizePublishedAt(pubdate),
    cover_url: cover ?? '',
  }

  if (debug) {
    console.log('[openbd] parsed metadata', {
      isbn,
      title: metadata.title,
      published_at: metadata.published_at,
      hasCoverUrl: metadata.cover_url.length > 0,
      coverUrlPreview: metadata.cover_url.slice(0, 120),
    })
  }

  return metadata
}
