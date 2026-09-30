'use client'

import { useEffect, useState } from 'react'
import {
  getAdminSettings,
  getAdminSystem,
  updateAdminSettings,
  type AppSettings,
  type EncoderOption,
  type SystemInfo,
} from '@/lib/api'

const EXTENSION_CHOICES = ['mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v', 'mpg', 'mpeg', 'ts', 'flv', 'wmv', '3gp', 'ogv', 'm2ts']

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [encoders, setEncoders] = useState<EncoderOption[]>([])
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getAdminSettings(), getAdminSystem()]).then(([s, sys]) => {
      if (s.data) {
        setSettings({
          transcodeProfiles: s.data.transcodeProfiles,
          allowedExtensions: s.data.allowedExtensions,
          encoder: s.data.encoder,
          concurrency: s.data.concurrency ?? null,
          ffmpegThreads: s.data.ffmpegThreads ?? null,
        })
        setEncoders(s.data.availableEncoders || [])
      } else if (s.error) {
        setError(s.error)
      }
      if (sys.data) setSystem(sys.data)
      setLoading(false)
    }).catch(() => {
      setError('Error de conexión')
      setLoading(false)
    })
  }, [])

  const toggleProfile = (quality: string) => {
    if (!settings) return
    setSettings({
      ...settings,
      transcodeProfiles: settings.transcodeProfiles.map(p =>
        p.quality === quality ? { ...p, active: !p.active } : p
      ),
    })
  }

  const setProfileBitrate = (quality: string, value: number) => {
    if (!settings) return
    setSettings({
      ...settings,
      transcodeProfiles: settings.transcodeProfiles.map(p =>
        p.quality === quality ? { ...p, bitrateKbps: value } : p
      ),
    })
  }

  const toggleExtension = (ext: string) => {
    if (!settings) return
    const has = settings.allowedExtensions.includes(ext)
    setSettings({
      ...settings,
      allowedExtensions: has
        ? settings.allowedExtensions.filter(e => e !== ext)
        : [...settings.allowedExtensions, ext],
    })
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    setError(null)
    const { error: saveError } = await updateAdminSettings(settings)
    if (saveError) setError(saveError)
    else setMessage('Ajustes guardados.')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!settings) {
    return <div className="p-8 text-red-400">{error || 'No se pudieron cargar los ajustes.'}</div>
  }

  return (
    <div className="min-h-full pb-20 animate-fade-in bg-[#050505] space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Ajustes</h1>
          <p className="text-sm text-white/40">Calidades de transcodificación, formatos aceptados y rendimiento.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all active:scale-95"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {message && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">{message}</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

      {/* Calidades */}
      <section className="bg-white/[0.02] p-8 rounded-[2rem] border border-white/5">
        <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-6">Calidades de transcodificación</h2>
        <p className="text-xs text-white/40 mb-6">
          Se generan solo las calidades activas que no superen la resolución del video original (sin upscaling).
        </p>
        <div className="space-y-3">
          {[...settings.transcodeProfiles].sort((a, b) => a.height - b.height).map(p => (
            <div key={p.quality} className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
              <label className="flex items-center gap-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={() => toggleProfile(p.quality)}
                  className="w-5 h-5 accent-purple-600"
                />
                <span className="text-sm font-semibold text-white w-20">{p.quality}</span>
                <span className="text-xs text-white/40">{p.width}x{p.height}</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-white/50">
                Bitrate (kbps)
                <input
                  type="number"
                  value={p.bitrateKbps}
                  onChange={(e) => setProfileBitrate(p.quality, parseInt(e.target.value || '0'))}
                  className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Formatos */}
      <section className="bg-white/[0.02] p-8 rounded-[2rem] border border-white/5">
        <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-6">Formatos de video aceptados</h2>
        <p className="text-xs text-white/40 mb-6">La API rechaza las subidas con otras extensiones.</p>
        <div className="flex flex-wrap gap-2">
          {EXTENSION_CHOICES.map(ext => {
            const active = settings.allowedExtensions.includes(ext)
            return (
              <button
                key={ext}
                onClick={() => toggleExtension(ext)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  active
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    : 'bg-white/[0.02] border-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                .{ext}
              </button>
            )
          })}
        </div>
      </section>

      {/* Rendimiento / encoder */}
      <section className="bg-white/[0.02] p-8 rounded-[2rem] border border-white/5">
        <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-6">Rendimiento y encoder</h2>

        {system && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">CPU (contenedor)</p>
              <p className="text-lg font-semibold text-white">{system.cpuCores} cores</p>
              <p className="text-[11px] text-white/40 truncate">{system.cpuModel}</p>
            </div>
            <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Memoria</p>
              <p className="text-lg font-semibold text-white">{system.totalMemGB} GB</p>
              <p className="text-[11px] text-white/40">{system.freeMemGB} GB libres</p>
            </div>
            <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Plataforma</p>
              <p className="text-lg font-semibold text-white">{system.platform}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="block">
            <span className="text-xs text-white/50 mb-2 block">Encoder de video</span>
            <select
              value={settings.encoder}
              onChange={(e) => setSettings({ ...settings, encoder: e.target.value })}
              className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-purple-500 focus:outline-none"
            >
              {(encoders.length ? encoders : [{ id: settings.encoder, label: settings.encoder, hardware: false }]).map(enc => (
                <option key={enc.id} value={enc.id}>{enc.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-white/50 mb-2 block">Concurrencia (workers)</span>
            <input
              type="number"
              value={settings.concurrency ?? ''}
              placeholder="auto"
              onChange={(e) => setSettings({ ...settings, concurrency: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-purple-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs text-white/50 mb-2 block">Threads FFmpeg por job</span>
            <input
              type="number"
              value={settings.ffmpegThreads ?? ''}
              placeholder="auto"
              onChange={(e) => setSettings({ ...settings, ffmpegThreads: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-purple-500 focus:outline-none"
            />
          </label>
        </div>

        <p className="text-xs text-white/30 mt-6">
          Los encoders de GPU requieren que el contenedor tenga acceso al dispositivo y una imagen de FFmpeg con soporte.
          La concurrencia se aplica al reiniciar el worker.
        </p>
      </section>
    </div>
  )
}
