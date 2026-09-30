'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAssets } from '@/hooks/useAssets'
import { UploadForm } from '@/components/UploadForm'
// Importamos tu componente VideoCard (Ajusta la ruta si es necesario)
import { VideoCard, VideoCardSkeleton } from '@/components/VideoCard'
import { getS3Url } from '@/lib/s3'

const statusStyles = {
    pending: { label: 'Pendiente', color: 'text-white/40', dot: 'bg-white/40' },
    uploading: { label: 'Subiendo', color: 'text-purple-400', dot: 'bg-purple-500' },
    processing: { label: 'Procesando', color: 'text-blue-400', dot: 'bg-blue-500 animate-pulse' },
    ready: { label: 'Live', color: 'text-green-400', dot: 'bg-green-500' },
    failed: { label: 'Error', color: 'text-red-400', dot: 'bg-red-500' },
}
const defaultStatus = { label: 'Desconocido', color: 'text-white/30', dot: 'bg-white/30' }

export default function StreamFlowVideos() {
    const { assets, loading, fetchAssets, refreshAsset } = useAssets()
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [showUpload, setShowUpload] = useState(false)

    useEffect(() => {
        fetchAssets()
    }, [fetchAssets])

    useEffect(() => {
        const processingAssets = assets.filter(a => a.status === 'processing' || a.status === 'pending')
        if (processingAssets.length === 0) return

        const interval = setInterval(async () => {
            for (const asset of processingAssets) {
                await refreshAsset(asset.id)
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [assets, refreshAsset])

    return (
        <div className="min-h-full pb-20 animate-fade-in bg-[var(--background)]">

            {/* HEADER APPLE STYLE */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pt-6">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] mb-1">
                        Biblioteca
                    </h1>
                    <p className="text-sm text-[var(--text-secondary)]">
                        {assets.length} activos disponibles
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Toggles Minimalistas */}
                    <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z" /></svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" /></svg>
                        </button>
                    </div>

                    <button
                        onClick={() => setShowUpload(true)}
                        className="px-5 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-all active:scale-95 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Subir Video
                    </button>
                </div>
            </div>

            {/* ÁREA DE CONTENIDO */}
            <div>
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(8)].map((_, i) => (
                            <VideoCardSkeleton key={i} />
                        ))}
                    </div>
                ) : assets.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center bg-white/[0.01] border border-white/5 rounded-3xl">
                        <div className="w-16 h-16 bg-white/[0.02] rounded-2xl flex items-center justify-center mb-6">
                            <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </div>
                        <h3 className="text-lg font-semibold tracking-tight mb-2">Base de datos vacía</h3>
                        <p className="text-[var(--text-secondary)] text-sm max-w-sm">No hay activos multimedia en el servidor. Inicia el proceso de ingesta.</p>
                    </div>
                ) : viewMode === 'grid' ? (

                    /* VISTA DE GRID (Usando directamente tu componente VideoCard) */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {assets.map((asset) => (
                            <VideoCard key={asset.id} asset={asset} />
                        ))}
                    </div>

                ) : (

                    /* VISTA DE LISTA COMPACTA (Sin tablas, sin botones extras) */
                    <div className="bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden">
                        {assets.map((asset, index) => {
                            const status = statusStyles[asset.status as keyof typeof statusStyles] || defaultStatus
                            const thumbUrl = asset.thumbnailKey ? getS3Url(asset.thumbnailKey) : null

                            return (
                                <Link
                                    href={`/dashboard/video/${asset.id}`}
                                    key={asset.id}
                                    className={`flex items-center gap-4 p-3 hover:bg-white/[0.03] transition-colors group ${index !== assets.length - 1 ? 'border-b border-white/5' : ''}`}
                                >
                                    {/* Thumbnail Pequeño */}
                                    <div className="w-24 shrink-0 aspect-video bg-black rounded-lg overflow-hidden relative border border-white/5">
                                        {thumbUrl ? (
                                            <img src={thumbUrl} alt={asset.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg className="w-5 h-5 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Central Limpia */}
                                    <div className="flex-1 min-w-0 flex items-center justify-between pr-4">
                                        <div className="flex flex-col justify-center">
                                            <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate mb-1 group-hover:text-[var(--primary)] transition-colors">{asset.title}</h4>
                                            <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] font-medium">
                                                <span className={`flex items-center gap-1.5 ${status.color}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                                    {status.label}
                                                </span>
                                                <span>•</span>
                                                <span>{new Date(asset.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        </div>

                                        {/* Duración */}
                                        <div className="text-xs text-[var(--text-secondary)] font-mono hidden sm:block">
                                            {asset.duration ? `${Math.floor(asset.duration / 60)}:${String(Math.floor(asset.duration % 60)).padStart(2, '0')}` : '--:--'}
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* MODAL CONTENEDOR (Setup Assistant) */}
            {showUpload && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setShowUpload(false)} />

                    <div className="relative bg-[#1c1c1e] border border-white/10 w-full max-w-xl rounded-[2rem] shadow-2xl flex flex-col min-h-[450px] animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-end p-4 absolute top-0 right-0 w-full z-10">
                            <button onClick={() => setShowUpload(false)} className="p-2 bg-black/20 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors backdrop-blur-md">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 p-8 flex flex-col justify-center">
                            <UploadForm onUploadComplete={() => {
                                setShowUpload(false)
                                fetchAssets()
                            }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}