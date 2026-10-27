'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { VideoPlayer } from '@/components/VideoPlayer'
import { ShareDropdown } from '@/components/ShareDropdown'
import { useAssets } from '@/hooks/useAssets'
import type { Asset } from '@/lib/api'
import { getS3Url } from '@/lib/s3'

// Configuración de estado minimalista
const statusConfig = {
  pending: { label: 'Pendiente', color: 'text-white/40', dot: 'bg-white/40' },
  uploading: { label: 'Subiendo', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  uploaded: { label: 'Subido', color: 'text-blue-400', dot: 'bg-blue-500' },
  processing: { label: 'Procesando', color: 'text-purple-400', dot: 'bg-purple-500 animate-pulse' },
  ready: { label: 'Publicado', color: 'text-green-400', dot: 'bg-green-500' },
  failed: { label: 'Error', color: 'text-red-400', dot: 'bg-red-500' },
}
const defaultStatus = { label: 'Desconocido', color: 'text-white/40', dot: 'bg-white/40' }

export default function VideoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { getAsset } = useAssets()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hlsUrl, setHlsUrl] = useState<string | undefined>(undefined)
  const [allowDownload, setAllowDownload] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // LÓGICA INTACTA
  useEffect(() => {
    const loadAsset = async () => {
      if (!params.id || typeof params.id !== 'string') return

      const data = await getAsset(params.id)
      if (data) {
        setAsset(data)
        if (data.status === 'ready' && data.playbackId) {
          const { getPlayback } = await import('@/lib/api')
          const { data: playbackData, error: playbackError } = await getPlayback(data.playbackId)
          if (playbackData) {
            setHlsUrl(playbackData.manifestUrl)
            setAllowDownload(playbackData.allowDownload ?? false)
          } else if (playbackError) {
            setError(playbackError)
          }
        }
      } else {
        setError('Video no encontrado en la base de datos.')
      }
      setLoading(false)
    }

    loadAsset()
  }, [params.id, getAsset])

  const executeDelete = async () => {
    if (!asset) return
    setDeleting(true)
    setShowDeleteModal(false)

    try {
      const { deleteAsset } = await import('@/lib/api')
      const { error: deleteError } = await deleteAsset(asset.id)
      if (deleteError) throw new Error(deleteError)
      router.push('/dashboard/videos')
    } catch (err) {
      console.error(err)
      setDeleting(false)
      setError('Fallo al eliminar el video de los servidores.')
    }
  }

  // VISTAS DE CARGA Y ERROR
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 bg-[#050505]">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !asset) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050505]">
        <div className="bg-white/[0.02] border border-red-500/20 max-w-lg w-full p-10 text-center rounded-[2rem]">
            <h2 className="text-xl font-bold mb-2 text-white">No se pudo cargar el activo</h2>
            <p className="text-white/40 text-sm mb-8">{error || 'El ID proporcionado no coincide con ningún video.'}</p>
            <Link href="/dashboard/videos" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors">
              Volver a la Biblioteca
            </Link>
        </div>
      </div>
    )
  }

  const status = statusConfig[asset.status as keyof typeof statusConfig] || defaultStatus

  return (
    <div className="min-h-full pb-20 animate-fade-in bg-[#050505]">
      
      <div className="pt-6 mb-10">
        <Link href="/dashboard/videos" className="text-white/40 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          Biblioteca
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        <div className="lg:col-span-5 flex flex-col">
          
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${status.color}`}>
              {status.label}
            </span>
          </div>

          <h1 className="text-2xl md:text-5xl lg:text-4xl font-bold text-white mb-4 tracking-tight leading-tight">
            {asset.title}
          </h1>

          <div className="space-y-4 mb-9 border-t border-white/5 pt-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">Fecha de Ingreso</span>
              <span className="text-sm text-white/80 font-medium">
                {new Date(asset.createdAt).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">Asset ID</span>
              <span className="text-xs text-white/50 font-mono break-all bg-white/[0.02] p-2 rounded-lg border border-white/5">
                {asset.id}
              </span>
            </div>
          </div>

          {asset.status === 'ready' && asset.playbackId ? (
            <div className="space-y-3">
              <Link
                href={`/watch/${asset.playbackId}`}
                className="w-full flex items-center justify-center gap-3 bg-white text-black px-6 py-4 rounded-xl font-bold transition-all hover:bg-white/90 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.15)]"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Reproducir
              </Link>

              <div className="flex items-center gap-3 pt-2">
                
                <button
                  onClick={() => {
                    const embedCode = `<iframe src="${window.location.origin}/embed/${asset.playbackId}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`
                    navigator.clipboard.writeText(embedCode)
                    setCopiedEmbed(true)
                    setTimeout(() => setCopiedEmbed(false), 2000)
                  }}
                  title="Copiar código Embed"
                  className="flex-1 h-14 flex items-center justify-center rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-white/60 hover:text-white transition-all"
                >
                  {copiedEmbed ? (
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                  )}
                </button>

                <ShareDropdown playbackId={asset.playbackId} />

                {allowDownload && (
                  <button
                    onClick={() => window.open(`/api/playback/${asset.playbackId}/download?quality=original`, '_self')}
                    title="Descargar Original"
                    className="flex-1 h-14 flex items-center justify-center rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-white/60 hover:text-white transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                )}

                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={deleting}
                  title="Eliminar Activo"
                  className="flex-1 h-14 flex items-center justify-center rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-6">
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-2 h-14 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors font-medium disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar Activo'}
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          <div className="bg-[#1c1c1e] border border-white/10 relative overflow-hidden shadow-2xl rounded-[2rem] aspect-video">
            {hlsUrl ? (
              <div className="w-full h-full relative group">
                <VideoPlayer
                  src={hlsUrl}
                  poster={asset.thumbnailKey ? getS3Url(asset.thumbnailKey) : undefined}
                />
                <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-[10px] text-white font-bold uppercase tracking-widest">Preview</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/40">
                <div className="text-center">
                  {asset.status === 'processing' && (
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
                      <p className="text-purple-400 font-bold text-sm tracking-widest uppercase animate-pulse">Procesando video</p>
                    </div>
                  )}
                  {asset.status === 'uploading' && (
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 border-2 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin mb-4" />
                      <p className="text-yellow-400 font-bold text-sm tracking-widest uppercase animate-pulse">Subiendo fuente</p>
                    </div>
                  )}
                  {asset.status === 'failed' && (
                    <div className="flex flex-col items-center text-red-500">
                      <svg className="w-12 h-12 mb-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <p className="font-bold text-sm tracking-widest uppercase">Error en el activo</p>
                    </div>
                  )}
                  {asset.status === 'pending' && (
                    <div className="flex flex-col items-center text-white/30">
                      <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110-4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                      <p className="font-bold text-sm tracking-widest uppercase">Esperando carga</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-transparent"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative bg-[#1c1c1e] border border-white/10 w-full max-w-sm p-8 rounded-[2rem] animate-in fade-in zoom-in-95 duration-200 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <h2 className="text-xl font-bold mb-2 text-white">Eliminar Video</h2>
            <p className="text-white/40 mb-8 text-sm leading-relaxed">
              ¿Deseas eliminar permanentemente este activo? El archivo maestro y sus derivados serán borrados.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={executeDelete}
                className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all"
              >
                Eliminar video
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3.5 rounded-xl bg-transparent text-white/60 hover:text-white transition-all font-medium text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}