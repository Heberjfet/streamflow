'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getCategories, createCategory, deleteCategory, Category, getAssets, updateAsset, Asset } from '@/lib/api'
import { getS3Url } from '@/lib/s3'
import { VideoCard } from '@/components/VideoCard'

function CatalogsPageContent() {
    const searchParams = useSearchParams()
    const [catalogs, setCatalogs] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCatalog, setSelectedCatalog] = useState<Category | null>(null)
    const [catalogVideos, setCatalogVideos] = useState<Asset[]>([])
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showAddVideoModal, setShowAddVideoModal] = useState(false)
    const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])
    const [availableVideos, setAvailableVideos] = useState<Asset[]>([])
    const [newCatalogName, setNewCatalogName] = useState('')
    const [newCatalogDescription, setNewCatalogDescription] = useState('')
    const [creating, setCreating] = useState(false)
    const [catalogToDelete, setCatalogToDelete] = useState<string | null>(null)

    useEffect(() => {
        loadCategories()
    }, [])

    useEffect(() => {
        if (selectedCatalog) {
            loadVideosForCatalog(selectedCatalog.id)
        }
    }, [selectedCatalog])

    useEffect(() => {
        const catalogId = searchParams.get('id')
        if (catalogId && catalogs.length > 0) {
            const found = catalogs.find(c => c.id === catalogId)
            if (found) {
                setSelectedCatalog(found)
            }
        }
    }, [searchParams, catalogs])

    const loadCategories = async () => {
        setLoading(true)
        const { data, error } = await getCategories()
        if (data) setCatalogs(data)
        setLoading(false)
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newCatalogName.trim()) return
        setCreating(true)
        const { data, error } = await createCategory({
            name: newCatalogName.trim(),
            description: newCatalogDescription.trim() || undefined
        })
        if (data) {
            setCatalogs([...catalogs, data])
            setNewCatalogName('')
            setNewCatalogDescription('')
            setShowCreateModal(false)
        }
        setCreating(false)
    }

    const executeDelete = async () => {
        if (!catalogToDelete) return
        const { error } = await deleteCategory(catalogToDelete)

        if (!error) {
            setCatalogs(catalogs.filter(c => c.id !== catalogToDelete))
            if (selectedCatalog?.id === catalogToDelete) {
                setSelectedCatalog(null)
            }
        }
        setCatalogToDelete(null)
    }

    const loadVideosForCatalog = async (categoryId: string) => {
        const { data } = await getAssets()
        if (data?.data) {
            const filtered = data.data.filter(v => v.categoryIds?.includes(categoryId))
            setCatalogVideos(filtered)
        }
    }

    const openAddVideoModal = async () => {
        const { data } = await getAssets()
        if (data?.data) {
            const notInCatalog = data.data.filter(v => !v.categoryIds?.includes(selectedCatalog!.id))
            setAvailableVideos(notInCatalog)
            setShowAddVideoModal(true)
        }
    }

    const handleAddVideo = async (assetId: string) => {
        if (!selectedCatalog) return
        const asset = availableVideos.find(v => v.id === assetId)
        const currentIds = asset?.categoryIds || []
        const { data, error } = await updateAsset(assetId, { categoryIds: [...currentIds, selectedCatalog.id] })
        if (data && !error) {
            await loadVideosForCatalog(selectedCatalog.id)
            setShowAddVideoModal(false)
        }
    }

    const toggleVideoSelection = (id: string) => {
        if (selectedVideoIds.includes(id)) {
            setSelectedVideoIds(selectedVideoIds.filter(vid => vid !== id))
        } else {
            setSelectedVideoIds([...selectedVideoIds, id])
        }
    }

    const handleAddSelectedVideos = async () => {
        if (!selectedCatalog || selectedVideoIds.length === 0) return
        const { data: allAssets } = await getAssets()
        if (!allAssets?.data) return
        for (const vid of selectedVideoIds) {
            const asset = allAssets.data.find(v => v.id === vid)
            const currentIds = asset?.categoryIds || []
            await updateAsset(vid, { categoryIds: [...new Set([...currentIds, selectedCatalog.id])] })
        }
        await loadVideosForCatalog(selectedCatalog.id)
        const notInCatalog = allAssets.data.filter(v => !v.categoryIds?.includes(selectedCatalog.id))
        setAvailableVideos(notInCatalog)
        setSelectedVideoIds([])
        setShowAddVideoModal(false)
    }

    // MODAL DE CONFIRMACIÓN DE ELIMINACIÓN (Sin backdrop blur, sin glow)
    const DeleteConfirmationModal = catalogToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Fondo transparente según petición */}
            <div className="absolute inset-0 bg-transparent" onClick={() => setCatalogToDelete(null)} />

            <div className="relative bg-[#1c1c1e] border border-white/10 w-full max-w-sm p-8 rounded-[2rem] animate-in fade-in zoom-in-95 duration-200 text-center shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </div>

                <h2 className="text-xl font-bold tracking-tight mb-2 text-white">Eliminar Catálogo</h2>
                <p className="text-white/40 mb-8 text-sm leading-relaxed">
                    ¿Estás seguro de que deseas eliminar este catálogo? Esta acción no se puede deshacer.
                </p>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={executeDelete}
                        // Botón limpio sin sombras/glows adicionales
                        className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all">
                        Eliminar catálogo
                    </button>
                    <button
                        onClick={() => setCatalogToDelete(null)}
                        className="w-full py-3.5 rounded-xl bg-transparent text-white/60 hover:text-white transition-all font-medium text-sm">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )

    // ==========================================
    // VISTA DE DETALLE DEL CATÁLOGO
    // ==========================================
    if (selectedCatalog) {
        return (
            <div className="animate-fade-in pb-20 bg-[#050505]">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10 pt-6">
                    <div>
                        <button
                            onClick={() => setSelectedCatalog(null)}
                            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors mb-6 font-medium text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            Volver a catálogos
                        </button>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-3">{selectedCatalog.name}</h1>
                        <p className="text-base text-white/50 max-w-2xl leading-relaxed">
                            {selectedCatalog.description || 'Sin descripción'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pt-8">
                        <button
                            onClick={() => setCatalogToDelete(selectedCatalog.id)}
                            className="px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Eliminar
                        </button>
                        <button
                            onClick={openAddVideoModal}
                            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-all active:scale-95 flex items-center gap-2">
                            Añadir Video
                        </button>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-white">Videos en la colección ({catalogVideos.length})</h2>
                    </div>
                    {catalogVideos.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center text-center bg-white/[0.01] border border-white/5 rounded-[2rem]">
                            <p className="text-white/40 text-sm max-w-sm">No hay videos asignados a este catálogo todavía.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {catalogVideos.map(video => (
                                <VideoCard key={video.id} asset={video} />
                            ))}
                        </div>
                    )}
                </div>

                {showAddVideoModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60" onClick={() => { setShowAddVideoModal(false); setSelectedVideoIds([]); }} />
                        <div className="relative bg-[#1c1c1e] border border-white/10 w-full max-w-2xl rounded-[2rem] animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] shadow-2xl">

                            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
                                <button onClick={() => { setShowAddVideoModal(false); setSelectedVideoIds([]); }} className="text-white/40 hover:text-white font-medium text-sm transition-colors w-16 text-left">
                                    Cancelar
                                </button>
                                <h2 className="text-lg font-bold tracking-tight text-white">Agregar Videos</h2>
                                <button
                                    onClick={handleAddSelectedVideos}
                                    disabled={selectedVideoIds.length === 0}
                                    className="text-purple-400 hover:text-purple-300 font-bold text-sm transition-colors disabled:opacity-30 disabled:hover:text-purple-400 w-16 text-right">
                                    Añadir
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {availableVideos.length === 0 ? (
                                    <div className="py-20 text-center">
                                        <p className="text-white/40 text-sm">No hay videos disponibles.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {availableVideos.map(video => {
                                            const isSelected = selectedVideoIds.includes(video.id)
                                            return (
                                                <div
                                                    key={video.id}
                                                    onClick={() => toggleVideoSelection(video.id)}
                                                    className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${isSelected
                                                        ? 'bg-purple-500/10 border-purple-500/20'
                                                        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
                                                        }`}
                                                >
                                                    <div className="w-24 shrink-0 aspect-video rounded-xl bg-black overflow-hidden border border-white/5 relative">
                                                        {video.thumbnailKey ? (
                                                            <img src={`http://localhost:9000/streamflow/${video.thumbnailKey}`} alt={video.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-semibold text-white truncate">{video.title}</h3>
                                                        <p className="text-xs text-white/40 mt-0.5 capitalize">{video.status}</p>
                                                    </div>

                                                    <div className="shrink-0 pr-2">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border-2 ${isSelected
                                                            ? 'border-purple-500 bg-purple-500'
                                                            : 'border-white/20'
                                                            }`}>
                                                            {isSelected && (
                                                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {DeleteConfirmationModal}
            </div>
        )
    }

    return (
        <div className="min-h-full pb-20 animate-fade-in bg-[#050505]">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pt-6">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">
                        Catálogos
                    </h1>
                    <p className="text-sm text-white/40">
                        Organiza tu contenido en colecciones.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-all active:scale-95 flex items-center gap-2"
                >
                    Crear Catálogo
                </button>
            </div>

            {loading ? (
                <div className="py-32 flex flex-col items-center justify-center text-center">
                    <p className="text-white/40 text-sm">Cargando catálogos...</p>
                </div>
            ) : catalogs.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-center bg-white/[0.01] border border-white/5 rounded-[2rem]">
                    <p className="text-white/40 text-sm">Aún no hay catálogos creados.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {catalogs.map((catalog) => (
                        <div
                            key={catalog.id}
                            onClick={() => setSelectedCatalog(catalog)}
                            className="group relative bg-white/[0.02] border border-white/5 rounded-[1.5rem] p-6 cursor-pointer transition-all duration-500 hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-1 overflow-hidden"
                        >
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all duration-500 shadow-inner">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                            </div>

                            <h3 className="text-lg font-bold tracking-tight text-white mb-1.5 group-hover:text-purple-400 transition-colors line-clamp-1">
                                {catalog.name}
                            </h3>
                            <p className="text-sm text-white/40 line-clamp-2 leading-relaxed">
                                {catalog.description || 'Sin descripción'}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setShowCreateModal(false)} />
                    <div className="relative bg-[#1c1c1e] border border-white/10 w-full max-w-md p-8 rounded-[2rem] animate-in fade-in zoom-in-95 duration-200 shadow-2xl">

                        {/* Sin icono de + como solicitaste */}
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold tracking-tight text-white">Nuevo Catálogo</h2>
                            <p className="text-sm text-white/40 mt-2">Crea una colección para organizar tus videos.</p>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-5">
                            <div>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newCatalogName}
                                    onChange={(e) => setNewCatalogName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/30 focus:border-purple-500 focus:outline-none transition-all text-center text-lg font-medium"
                                    placeholder="Nombre del catálogo"
                                    required
                                />
                            </div>
                            <div>
                                <textarea
                                    value={newCatalogDescription}
                                    onChange={(e) => setNewCatalogDescription(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/30 focus:border-purple-500 focus:outline-none resize-none transition-all text-center text-sm"
                                    placeholder="Descripción (Opcional)"
                                    rows={2}
                                />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 font-medium text-sm transition-all">Cancelar</button>
                                <button type="submit" disabled={creating || !newCatalogName.trim()} className="flex-[2] py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95">
                                    {creating ? 'Creando...' : 'Crear Catálogo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {DeleteConfirmationModal}
        </div>
    )
}

export default function CatalogsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-white/40">Cargando...</div>}>
            <CatalogsPageContent />
        </Suspense>
    )
}