'use client'

import Link from 'next/link'
import type { Asset } from '@/lib/api'
import { getS3Url } from '@/lib/s3'

interface VideoCardProps {
  asset: Asset
  showStatus?: boolean
}

const statusConfig = {
  uploading: { label: 'Subiendo...', classes: 'text-amber-400' },
  processing: { label: 'Procesando...', classes: 'text-blue-400' },
  failed: { label: 'Error', classes: 'text-red-400' },
}

const formatDuration = (seconds?: number): string => {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function VideoCard({ asset, showStatus = true }: VideoCardProps) {
  const needsStatusLabel = asset.status !== 'ready'
  const statusInfo = statusConfig[asset.status as keyof typeof statusConfig]

  return (
    <Link href={`/dashboard/video/${asset.id}`} className="block group">
      <div className="flex flex-col gap-3">
        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-white/5">
          {asset.thumbnailKey ? (
            <img
              src={getS3Url(asset.thumbnailKey)}
              alt={asset.title}
              className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
              <svg className="w-10 h-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {asset.duration && (
            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-bold text-white tracking-tight">
              {formatDuration(asset.duration)}
            </div>
          )}

          {showStatus && needsStatusLabel && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 pr-2">
          <h3 className="font-bold text-base text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {asset.title}
          </h3>

          <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--text-secondary)] font-medium">
            <span>{formatDate(asset.createdAt)}</span>

            {showStatus && needsStatusLabel && statusInfo && (
              <>
                <span className="text-white/20">•</span>
                <span className={`${statusInfo.classes} font-bold`}>
                  {statusInfo.label}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="aspect-video w-full rounded-xl bg-white/5 animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-white/5 animate-pulse" />
      </div>
    </div>
  )
}