'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { getAdminSettings, updateAdminSettings } from '@/lib/api'

export function AdminRegistrationAlert() {
  const { user } = useAuth()
  const [allowRegistration, setAllowRegistration] = useState<boolean | null>(null)
  const [isDismissed, setIsDismissed] = useState(true) // evitar flash antes de comprobar sessionStorage
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Comprobar si el admin ya descartó el aviso en esta sesión
    const dismissed = sessionStorage.getItem('streamflow_dismissed_reg_alert') === 'true'
    setIsDismissed(dismissed)

    if (user?.role === 'admin' && !dismissed) {
      getAdminSettings()
        .then((res) => {
          if (res.data) {
            setAllowRegistration(Boolean(res.data.allowRegistration))
          }
        })
        .catch(() => {
          // Silencioso en caso de error de red puntual
        })
    }
  }, [user])

  const handleDismiss = () => {
    setIsDismissed(true)
    sessionStorage.setItem('streamflow_dismissed_reg_alert', 'true')
  }

  const handleDisableRegistration = async () => {
    setIsSaving(true)
    setError(null)
    const res = await updateAdminSettings({ allowRegistration: false })
    setIsSaving(false)

    if (res.error) {
      setError(res.error)
    } else {
      setSuccessMessage('Registro público desactivado correctamente')
      setAllowRegistration(false)
      setTimeout(() => {
        setIsDismissed(true)
      }, 2500)
    }
  }

  // Solo se muestra a administradores si el registro está activado y no se ha descartado
  if (!user || user.role !== 'admin' || isDismissed || allowRegistration !== true) {
    return null
  }

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#18140c]/90 to-[#0e0e0e]/90 p-5 md:p-6 backdrop-blur-xl shadow-xl shadow-amber-950/20 animate-fade-in-up">
      {/* Resplandor ambiental de fondo */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Instancia Pública
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                El registro de nuevos usuarios está habilitado
              </h3>
            </div>
            <p className="text-sm text-zinc-300/90 leading-relaxed max-w-3xl font-normal">
              Cualquier usuario que tenga acceso a la URL de esta instancia puede crear una cuenta y subir contenido.
              Si este es un entorno personal o privado, te sugerimos desactivar el registro libre.
            </p>
            {error && <p className="text-xs text-red-400 font-medium mt-1">{error}</p>}
            {successMessage && (
              <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {successMessage}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0 pt-2 md:pt-0 border-t border-white/5 md:border-t-0">
          <button
            onClick={handleDisableRegistration}
            disabled={isSaving || Boolean(successMessage)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black text-xs font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                <span>Desactivando...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span>Desactivar registro</span>
              </>
            )}
          </button>

          <Link
            href="/dashboard/settings"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-all"
          >
            Configuración
          </Link>

          <button
            onClick={handleDismiss}
            title="Descartar aviso para esta sesión"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
