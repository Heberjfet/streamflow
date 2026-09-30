'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, loading, router])

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
    </div>
  )

  if (!isAuthenticated) return null

  return (
    <div className="h-screen bg-[#050505] flex overflow-hidden text-slate-200">

      {/* Sidebar Neo-Glass */}
      <aside
        className={`
          transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isSidebarOpen ? 'w-70' : 'w-24'}
          relative border-r border-white/5 bg-white/[0.01] backdrop-blur-3xl z-50 flex flex-col
        `}
      >
        {/* Pestaña centrada para sacar/esconder el sidebar */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-[#0a0a0a] border border-white/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors z-[60] shadow-xl group"
        >
          <svg
            className={`w-3 h-3 text-white transition-transform duration-500 ${isSidebarOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Zona Superior: Logo y Buscador */}
        <div className="shrink-0">
          <div className="h-28 flex items-center px-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-500 shadow-[0_0_25px_rgba(147,51,234,0.3)] flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              {isSidebarOpen && <span className="font-bold tracking-tighter text-2xl text-white">StreamFlow</span>}
            </div>
          </div>

          <div className="px-5">
            <SidebarLink href="/dashboard/search" icon="search" active={pathname === '/dashboard/search'} isOpen={isSidebarOpen}>
              Buscar
            </SidebarLink>
          </div>
        </div>

        {/* Navegación Principal (Totalmente Centrada Verticalmente) */}
        <div className="flex-1 flex flex-col justify-center px-5 space-y-2">
          <SidebarLink href="/dashboard" icon="home" active={pathname === '/dashboard'} isOpen={isSidebarOpen}>Inicio</SidebarLink>
          <SidebarLink href="/dashboard/videos" icon="video" active={pathname === '/dashboard/videos'} isOpen={isSidebarOpen}>Biblioteca</SidebarLink>
          <SidebarLink href="/dashboard/catalogs" icon="folder" active={pathname === '/dashboard/catalogs'} isOpen={isSidebarOpen}>Catálogos</SidebarLink>
        </div>

        {/* Zona Inferior: Administración y Perfil */}
        <div className="mt-auto flex flex-col shrink-0">

          {user?.role === 'admin' && (
            <div className="px-5 pb-8 space-y-2">
              {isSidebarOpen && (
                <p className="px-4 text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">
                  Administración
                </p>
              )}
              <SidebarLink href="/dashboard/users" icon="users" active={pathname === '/dashboard/users'} isOpen={isSidebarOpen}>Usuarios</SidebarLink>
              <SidebarLink href="/dashboard/logs" icon="log" active={pathname === '/dashboard/logs'} isOpen={isSidebarOpen}>Actividad</SidebarLink>
              <SidebarLink href="/dashboard/settings" icon="settings" active={pathname === '/dashboard/settings'} isOpen={isSidebarOpen}>Ajustes</SidebarLink>
            </div>
          )}

          {/* Apartado de Perfil Ultra Limpio */}
          <div className="p-6 border-t border-white/5 bg-transparent">
            <div className={`flex flex-col gap-5 ${isSidebarOpen ? 'items-start' : 'items-center'}`}>
              <div className="flex items-center gap-4 w-full">
                <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-400 text-xl shadow-lg shrink-0">
                  {user?.name?.charAt(0) || 'E'}
                </div>
                {isSidebarOpen && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-bold text-white truncate">{user?.name}</span>
                    <span className="text-[11px] text-white/30 font-medium uppercase tracking-wider">{user?.role}</span>
                  </div>
                )}
              </div>

              {isSidebarOpen && (
                <div className="w-full space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="px-1">
                    <p className="text-sm text-white/50 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-red-500/10 text-red-500/80 hover:text-red-400 text-sm font-bold transition-all group"
                  >
                    Cerrar Sesión
                    <svg className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#050505] selection:bg-purple-500/30">
        <div className="p-10 lg:p-16 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

function SidebarLink({ href, icon, children, active, isOpen }: { href: string, icon: string, children: React.ReactNode, active: boolean, isOpen: boolean }) {
  const getIcon = () => {
    switch (icon) {
      case 'home': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      case 'search': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      case 'video': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      case 'folder': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      case 'users': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      case 'log': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      case 'settings': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      default: return null
    }
  }

  return (
    <Link
      href={href}
      className={`
        relative flex items-center group transition-all duration-300 border
        ${isOpen ? 'px-5 py-4 rounded-2xl' : 'justify-center py-5 rounded-3xl'}
        ${active
          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[inset_0_0_15px_rgba(168,85,247,0.1)]'
          : 'border-transparent text-white/30 hover:bg-purple-500/5 hover:text-white/60'}
      `}
    >
      <svg className={`shrink-0 transition-all duration-300 ${isOpen ? 'w-6 h-6' : 'w-8 h-8'} ${active ? 'scale-110' : 'group-hover:scale-110'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {getIcon()}
      </svg>
      {isOpen && (
        <span className="ml-4 text-base font-bold tracking-tight">
          {children}
        </span>
      )}
      {active && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-500 rounded-l-full shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
      )}
    </Link>
  )
}