import { headers } from 'next/headers'

const PRODUCTION_APP_URL = 'https://www.familyexplorer.net'
const LOCAL_APP_URL = 'http://localhost:3000'

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

export async function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
  }

  try {
    const requestHeaders = await headers()
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
    const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'

    if (host) {
      return `${protocol}://${host}`
    }
  } catch {
    // Fall through to static defaults when request headers are unavailable.
  }

  return process.env.NODE_ENV === 'production' ? PRODUCTION_APP_URL : LOCAL_APP_URL
}
