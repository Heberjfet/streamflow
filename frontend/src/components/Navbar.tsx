'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect } from 'react'

export function Navbar() {
  const pathname = usePathname()
  const { isAuthenticated, loading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isActive = (path: string) => pathname === path

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">

      <div
        className={`
          absolute inset-0 -z-10 transition-all duration-500
          bg-[#121212]/60 backdrop-blur-xl border-b border-white/10 shadow-lg
          ${scrolled ? 'shadow-purple-900/10' : 'shadow-black/20'}
        `}
      />

      <div className={`absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none transition-opacity duration-500 ${scrolled ? 'opacity-0' : 'opacity-100'}`} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className={`flex items-center justify-between transition-all duration-500 ${scrolled ? 'h-16' : 'h-24'}`}>

          <Link href={isAuthenticated ? '/dashboard' : '/login'} className="group flex items-center gap-3.5 z-50">
            <div className={`relative transition-all duration-500 ${scrolled ? 'w-8 h-8' : 'w-10 h-10'}`}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-xl rotate-3 group-hover:rotate-6 transition-transform duration-500 shadow-lg shadow-purple-500/40" />
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-xl flex items-center justify-center">
                <svg className={`${scrolled ? 'w-4 h-4' : 'w-5 h-5'} text-white ml-0.5 transition-all duration-500`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
            </div>
            <span className={`font-bold tracking-tight transition-all duration-500 ${scrolled ? 'text-xl' : 'text-2xl'}`}>
              <span className="text-white italic uppercase">Stream</span>
              <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent italic uppercase">Flow</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className={`
                relative px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-300
                ${isActive('/login')
                  ? 'text-white bg-white/10'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }
                before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-r before:from-purple-500/10 before:to-fuchsia-500/10 before:opacity-0 before:transition-opacity hover:before:opacity-100
              `}
            >
              <span className="relative z-10">Iniciar Sesión</span>
            </Link>

            <Link
              href="/register"
              className="
                relative px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest
                bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white
                shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02]
                transition-all duration-300 active:scale-[0.98]
                overflow-hidden group border border-white/10
              "
            >
              <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.15),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative z-10 flex items-center gap-2">
                Comenzar Gratis
              </span>
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden relative w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors duration-300 flex items-center justify-center z-50"
            aria-label="Toggle menu"
          >
            <div className="relative w-5 h-4">
              <span className={`absolute left-0 top-0 w-full h-0.5 bg-white rounded-full transition-all duration-300 ${mobileOpen ? 'rotate-45 top-1/2 -translate-y-1/2' : ''}`} />
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-white rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0 scale-0' : ''}`} />
              <span className={`absolute left-0 bottom-0 w-full h-0.5 bg-white rounded-full transition-all duration-300 ${mobileOpen ? '-rotate-45 top-1/2 -translate-y-1/2' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      <div className={`
        md:hidden absolute top-full left-0 right-0 -z-20
        bg-[#121212]/60 backdrop-blur-xl
        transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top overflow-hidden
        ${mobileOpen ? 'max-h-[350px] opacity-100 border-b border-white/10 shadow-xl' : 'max-h-0 opacity-0 border-b border-transparent'}
      `}>
        <div className={`flex flex-col items-center justify-center py-10 gap-5 transform transition-transform duration-500 delay-75 ${mobileOpen ? 'translate-y-0' : '-translate-y-10'}`}>
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="
              inline-flex justify-center items-center w-full max-w-[240px]
              px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest
              text-white bg-white/10 border border-white/10
              transition-all duration-300
            "
          >
            Iniciar Sesión
          </Link>

          <Link
            href="/register"
            onClick={() => setMobileOpen(false)}
            className="
              inline-flex justify-center items-center w-full max-w-[240px] px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest
              bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white
              shadow-lg shadow-purple-500/25 active:scale-95 border border-white/10
              transition-all duration-300
            "
          >
            Comenzar Gratis
          </Link>
        </div>
      </div>
    </nav>
  )
}