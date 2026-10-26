const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_S3_URL
  if (typeof window !== 'undefined') {
    if (!envUrl || ((envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return `${window.location.protocol}//${window.location.hostname}:9000`
    }
    return envUrl
  }
  return envUrl || 'http://localhost:9000'
}

export const getS3Url = (key: string): string => {
  const base = getBaseUrl().replace(/\/?$/, '')
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET || 'streamflow'
  return `${base}/${bucket}/${key}`
}

export const fixS3Hostname = (url: string): string => {
  if (!url || typeof window === 'undefined') return url
  if (url.includes('localhost:9000') || url.includes('minio:9000')) {
    const baseUrl = process.env.NEXT_PUBLIC_S3_URL || `${window.location.protocol}//${window.location.hostname}:9000`
    return url.replace(/https?:\/\/localhost:9000|https?:\/\/minio:9000/, baseUrl.replace(/\/?$/, ''))
  }
  return url
}
