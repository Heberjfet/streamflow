'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Navbar } from '@/components/Navbar'
import { getPublicSettings } from '@/lib/api'

const features = [
  {
    title: 'CDN Global',
    description: 'Edge caching en todo el mundo. Tu contenido llega más rápido, sin importar la distancia.',
  },
  {
    title: 'Privado y Seguro',
    description: 'Control total sobre quién ve tu contenido. Tokens de acceso, autenticación y cifrado.',
  },
  {
    title: 'Análisis',
    description: 'Métricas en tiempo real. Vistas, retención y rendimiento detallado.',
  },
]

function HomeContent() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const forceLanding = searchParams.get('landing') === '1'
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (loading) return

    if (isAuthenticated) {
      router.replace('/dashboard')
      return
    }

    if (forceLanding) {
      setChecking(false)
      return
    }

    getPublicSettings()
      .then((res) => {
        if (res.data?.hasUsers) {
          router.replace('/login')
        } else {
          setChecking(false)
        }
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [isAuthenticated, loading, router, forceLanding])

  if (checking || (loading && !forceLanding)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050505] text-white">
      <div className="noise-overlay" />

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] animate-pulse-glow gradient-radial-primary opacity-40" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] animate-pulse-glow gradient-radial-secondary opacity-30" />
      </div>

    <Navbar />

      <main className="relative z-10">
        <section className="h-[100dvh] min-h-[800px] flex flex-col justify-center px-8 max-w-[1400px] mx-auto">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-[#121212]/50 mb-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span className="text-sm font-medium text-zinc-300">
                Infraestructura de video
              </span>
            </div>

            <h1 className="text-6xl lg:text-8xl xl:text-9xl font-black uppercase leading-none mb-8">
              <span className="block text-white mb-2">Transmite tu</span>
              <span className="gradient-text">Contenido</span>
            </h1>

            <p className="text-xl lg:text-2xl text-zinc-400 font-light leading-relaxed max-w-2xl mb-12">
              La plataforma de video self-hosted minimalista.
              <span className="text-white font-medium"> Sin límites, sin comisiones.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/register" className="btn-primary w-full sm:w-auto px-10 py-5 text-base hover-glow text-center">
                Comenzar Gratis
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 px-8 max-w-[1400px] mx-auto border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className={`glass-card p-10 rounded-3xl hover-glow transition-all duration-500 animate-fade-in-up delay-100`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                  <div className="w-4 h-4 rounded-full gradient-button" />
                </div>
                <h3 className="text-2xl font-bold uppercase mb-4">
                  {feature.title}
                </h3>
                <p className="text-base text-zinc-400 font-light leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-8 max-w-[1400px] mx-auto border-t border-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1 space-y-6">
              <h2 className="text-5xl lg:text-6xl font-bold uppercase leading-tight">
                Sube contenido <br />
                <span className="text-zinc-500">al instante</span>
              </h2>
              <p className="text-lg text-zinc-400 font-light max-w-md">
                Arrastra y suelta tus archivos en nuestro gestor impulsado por edge-computing. Procesamiento inmediato sin tiempos de espera.
              </p>
            </div>

            <Link href="/login" className="order-1 lg:order-2 block glass-card p-6 rounded-3xl group cursor-pointer animate-fade-in-up hover-glow transition-all duration-500 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-6 px-2 relative z-10">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>

              <div className="border border-dashed border-white/20 rounded-2xl p-16 flex flex-col items-center justify-center bg-[#050505]/50 group-hover:bg-purple-500/10 transition-colors duration-500 relative overflow-hidden z-10">
                <svg className="w-16 h-16 text-purple-400 mb-6 transform group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <div className="text-xl font-medium mb-2 text-white">Iniciar sesión para subir</div>
                <div className="text-sm text-zinc-500">Haz clic para continuar</div>
              </div>
            </Link>
          </div>
        </section>

        <section className="py-16 px-8 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <Link href="/login" className="block glass-card p-6 rounded-3xl group cursor-pointer animate-fade-in-up delay-100 hover-glow transition-all duration-500">
              <div className="flex items-center gap-2 mb-6 px-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>

              <div className="relative aspect-video bg-[#050505] rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center group-hover:border-purple-500/50 transition-colors duration-500">
                <div className="absolute inset-0 gradient-radial-primary opacity-0 group-hover:opacity-40 transition-opacity duration-700" />

                <div className="play-button w-20 h-20 rounded-full gradient-button flex items-center justify-center shadow-lg z-10 group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>

                <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="text-sm font-mono text-white">EN VIVO</div>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-white/20 group-hover:gradient-button transition-all duration-500" />
                  </div>
                  <div className="text-sm font-mono text-white">Calidad Original</div>
                </div>
              </div>
            </Link>

            <div className="space-y-6">
              <h2 className="text-5xl lg:text-6xl font-bold uppercase leading-tight">
                Reproducción <br />
                <span className="gradient-text italic">Inmersiva</span>
              </h2>
              <p className="text-lg text-zinc-400 font-light max-w-md">
                Un reproductor minimalista diseñado para mantener la atención de tu audiencia. Fidelidad absoluta, sin distracciones visuales.
              </p>
            </div>
          </div>
        </section>

        <section className="relative py-40 border-y border-white/10 bg-fixed bg-center" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.15) 0%, #050505 80%)' }}>
          <div className="absolute inset-0 backdrop-blur-[2px]" />
          <div className="relative z-10 max-w-[1400px] mx-auto px-8 text-center">
            <h2 className="text-5xl lg:text-7xl font-black uppercase text-white mb-6 mix-blend-overlay opacity-80">
              Escalabilidad Soberana
            </h2>
            <p className="text-xl lg:text-3xl text-zinc-400 font-light max-w-3xl mx-auto">
              Diseñado estructuralmente para soportar desde tu primer espectador hasta una audiencia masiva global, manteniendo siempre el control de tu lado.
            </p>
          </div>
        </section>

        <section className="h-[100dvh] min-h-[800px] flex items-center justify-center px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent pointer-events-none" />

          <div className="glass-card w-full max-w-6xl mx-auto rounded-[3rem] p-12 md:p-24 lg:p-32 text-center border-white/20 animate-fade-in-up overflow-hidden relative group shadow-[0_0_80px_rgba(168,85,247,0.1)] hover:shadow-[0_0_120px_rgba(168,85,247,0.2)] transition-shadow duration-700">
            <div className="absolute inset-0 gradient-radial-primary opacity-20 group-hover:opacity-40 transition-opacity duration-700" />
            <div className="relative z-10">
              <h2 className="text-6xl lg:text-8xl xl:text-9xl font-black uppercase leading-none mb-8">
                Toma el <br />
                <span className="gradient-text">Control</span>
              </h2>

              <p className="text-xl lg:text-2xl text-zinc-300 font-light max-w-2xl mx-auto mb-16 leading-relaxed">
                Únete a la nueva generación de creadores que deciden las reglas. Aloja, distribuye y monetiza tu contenido en una plataforma verdaderamente tuya.
              </p>

              <Link href="/register" className="btn-primary inline-block px-16 py-6 text-xl hover-glow transition-all uppercase font-black">
                INICIAR AHORA
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-8 py-10 border-t border-white/10 bg-[#050505] relative z-20">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="text-xl font-bold uppercase italic">StreamFlow</span>

          <div className="flex items-center gap-8">
            <Link href="/terms" className="text-sm uppercase font-medium text-white opacity-30 hover:opacity-100 transition-opacity">
              Términos y Condiciones
            </Link>

            <div className="flex items-center gap-5">
              <a href="https://github.com/Heberjfet/streamflow-v2" target="_blank" rel="noopener noreferrer" className="text-white hover:text-purple-400 transition-all duration-300">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
              </a>

              <a href="#" target="_blank" rel="noopener noreferrer" className="text-white hover:text-purple-400 transition-all duration-300">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  )
}