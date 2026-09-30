'use client'

import { useEffect, useState } from 'react'
import { useAssets } from '@/hooks/useAssets'
import { getCategories, Category } from '@/lib/api'
import { getS3Url } from '@/lib/s3'
import Link from 'next/link'

const statusColors: Record<string, string> = {
    pending: 'text-white/40',
    uploading: 'text-yellow-400',
    processing: 'text-blue-400',
    ready: 'text-green-400',
    failed: 'text-red-400',
}

export default function SearchPage() {
    const { assets, fetchAssets } = useAssets()
    const [categories, setCategories] = useState<Category[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        fetchAssets()
        loadCategories()
    }, [])

    const loadCategories = async () => {
        const { data } = await getCategories()
        if (data) setCategories(data)
    }

    const getCategoryVideoCount = (categoryId: string) => {
        return assets.filter(a => a.categoryId === categoryId).length
    }

    const filteredCategories = searchQuery.trim()
        ? categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : []

    const filteredVideos = searchQuery.trim()
        ? assets.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : []

    const hasResults = filteredCategories.length > 0 || filteredVideos.length > 0
    const isSearching = searchQuery.trim().length > 0

    return (
        <div className="flex flex-col w-full min-h-[80vh] justify-center items-center bg-[#050505] transition-all duration-700">
            <div className="w-full max-w-3xl mx-auto px-6">

                <div className={`text-center transition-all duration-700 ${isSearching ? 'mb-8 opacity-40 scale-95' : 'mb-12 opacity-100 scale-100'}`}>
                    <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight text-white">
                        ¿Qué estás buscando?
                    </h1>
                    <p className="text-white/30 text-lg max-w-lg mx-auto font-medium">
                        Encuentra videos y catálgoos en segundos.
                    </p>
                </div>

                <div className="relative z-20 w-full">
                    <div className={`flex items-center gap-4 px-8 py-6 rounded-[2rem] border transition-all duration-300 bg-[#1c1c1e]/80 backdrop-blur-2xl shadow-2xl ${isSearching ? 'border-purple-500/40 shadow-[0_10px_40px_rgba(147,51,234,0.1)]' : 'border-white/10 hover:border-white/20'}`}>
                        <input
                            type="text"
                            placeholder="Escribe el nombre de un video o catálogo..."
                            className="flex-1 bg-transparent outline-none text-xl sm:text-2xl font-medium text-white placeholder:text-white/10 text-center w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {isSearching && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className={`transition-all duration-700 ease-out w-full ${isSearching ? 'opacity-100 translate-y-0 mt-12' : 'opacity-0 translate-y-8 pointer-events-none absolute'}`}>
                    {hasResults ? (
                        <div className="space-y-12 pb-20">

                            {filteredCategories.length > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-6 text-center">
                                        Catálogos
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {filteredCategories.map(category => (
                                            <Link
                                                key={category.id}
                                                href={`/dashboard/catalogs?id=${category.id}`}
                                                className="group flex items-center gap-4 bg-white/[0.02] border border-white/5 hover:border-purple-500/30 hover:bg-white/[0.04] transition-all p-5 rounded-2xl cursor-pointer"
                                            >
                                                <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <h3 className="font-bold text-white truncate text-base">{category.name}</h3>
                                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{getCategoryVideoCount(category.id)} items</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {filteredVideos.length > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                                    <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-6 text-center">
                                        Videos
                                    </h3>
                                    <div className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
                                        {filteredVideos.map((video, index) => {
                                            const thumbUrl = video.thumbnailKey ? getS3Url(video.thumbnailKey) : null

                                            return (
                                                <Link
                                                    key={video.id}
                                                    href={`/dashboard/video/${video.id}`}
                                                    className={`group flex items-center gap-5 p-4 hover:bg-white/[0.03] transition-colors cursor-pointer ${index !== filteredVideos.length - 1 ? 'border-b border-white/5' : ''}`}
                                                >
                                                    <div className="w-24 shrink-0 aspect-video rounded-xl bg-black overflow-hidden relative border border-white/5">
                                                        {thumbUrl ? (
                                                            <img src={thumbUrl} alt={video.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <svg className="w-6 h-6 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0 text-left">
                                                        <h4 className="text-base font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                                                            {video.title}
                                                        </h4>
                                                        <div className="flex items-center gap-3 text-[10px] uppercase font-black tracking-widest mt-1">
                                                            <span className={statusColors[video.status] || 'text-white/40'}>
                                                                {video.status}
                                                            </span>
                                                            <span className="text-white/10">•</span>
                                                        </div>
                                                    </div>

                                                    <div className="pr-4 text-white/10 group-hover:text-purple-500 transition-colors">
                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="text-center py-20 animate-in fade-in zoom-in-95">
                            <h3 className="text-xl font-bold text-white mb-2 opacity-50">Sin coincidencias</h3>
                            <p className="text-white/20">No encontramos nada para "<span className="text-white/40 italic">{searchQuery}</span>"</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}