'use client'

import { VideoPlayer } from '@/components/VideoPlayer'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { useState, useEffect } from 'react'
import type { PlaybackResponse } from '@/lib/api'

export default function VideoPlayerPage() {
  const params = useParams()
  const [playback, setPlayback] = useState<PlaybackResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPlayback = async () => {
      if (!params.id || typeof params.id !== 'string') return

      const { getAsset, getPlayback } = await import('@/lib/api')
      const { data: asset, error: assetError } = await getAsset(params.id)
      if (assetError || !asset || !asset.playbackId) {
        setError(assetError || 'Video not found')
        setLoading(false)
        return
      }
      const { data, error: fetchError } = await getPlayback(asset.playbackId)

      if (fetchError || !data) {
        setError(fetchError || 'Video not found')
      } else {
        setPlayback(data)
      }
      setLoading(false)
    }

    loadPlayback()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-3 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !playback) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Video not found</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">{error}</p>
          <Link href="/dashboard">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">{playback.title}</h1>
        </div>
        <VideoPlayer
          src={playback.manifestUrl}
          poster={playback.thumbnailUrl}
          autoplay
          playbackId={playback.playbackId}
        />
        <div className="mt-4 text-center">
          <Link href="/dashboard" className="text-[var(--color-text-muted)] hover:text-white transition-colors text-sm">
            StreamFlow
          </Link>
        </div>
      </div>
    </div>
  )
}
