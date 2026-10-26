'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getAdminStats,
  getAdminLogs,
  AdminStats,
  AdminLogs,
  AuditItem,
  ServiceHealth,
  HostMetrics,
  ProcessMetrics
} from '@/lib/api'

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`
  return `${mins}m ${secs}s`
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSec = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diffInSec < 5) return 'hace un instante'
  if (diffInSec < 60) return `hace ${diffInSec}s`
  const diffInMin = Math.floor(diffInSec / 60)
  if (diffInMin < 60) return `hace ${diffInMin}m`
  const diffInHours = Math.floor(diffInMin / 60)
  if (diffInHours < 24) return `hace ${diffInHours}h`
  const diffInDays = Math.floor(diffInHours / 24)
  return `hace ${diffInDays}d`
}

const statusBadgeClasses: Record<string, string> = {
  ready: 'bg-green-500/10 text-green-400 border-green-500/20',
  processing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  uploaded: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  uploading: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  pending: 'bg-white/10 text-white/60 border-white/10',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

const serviceStatusClasses: Record<string, { badge: string; dot: string; label: string }> = {
  healthy: {
    badge: 'bg-green-500/10 text-green-400 border-green-500/20',
    dot: 'bg-green-400',
    label: 'Saludable'
  },
  warning: {
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    dot: 'bg-yellow-400',
    label: 'Alerta'
  },
  degraded: {
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    dot: 'bg-orange-400',
    label: 'Degradado'
  },
  down: {
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    dot: 'bg-red-400',
    label: 'Desconectado'
  }
}

export default function LogsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [logs, setLogs] = useState<AdminLogs | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [secondsSinceLastUpdate, setSecondsSinceLastUpdate] = useState(0)

  // Polling controlado
  const [pollingInterval, setPollingInterval] = useState<number>(3000) // 3000ms = 3s, 10000 = 10s, 30000 = 30s, 0 = Pausado
  const [isPaused, setIsPaused] = useState<boolean>(false)

  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'assets' | 'users' | 'failed'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal de Detalle de Auditoría
  const [selectedAuditItem, setSelectedAuditItem] = useState<AuditItem | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const isInitialLoad = useRef(true)

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    try {
      const [statsRes, logsRes] = await Promise.all([
        getAdminStats(),
        getAdminLogs({
          page: currentPage,
          limit: pageSize,
          search: searchQuery,
          type: typeFilter,
          status: statusFilter
        })
      ])

      if (statsRes.error || !statsRes.data) {
        setError(statsRes.error || 'Error al cargar métricas del sistema')
      } else {
        setStats(statsRes.data)
        setLastUpdate(new Date())
        setSecondsSinceLastUpdate(0)
        setError(null)
      }

      if (!logsRes.error && logsRes.data) {
        setLogs(logsRes.data)
      }

      if (isInitialLoad.current) {
        isInitialLoad.current = false
        setLoading(false)
      }
    } catch (err) {
      console.error('Error cargando actividad:', err)
      setError('Error de conexión con el backend')
      setLoading(false)
    } finally {
      if (isManualRefresh) {
        setTimeout(() => setRefreshing(false), 300)
      }
    }
  }, [currentPage, pageSize, searchQuery, typeFilter, statusFilter])

  // Polling effect
  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (isPaused || pollingInterval <= 0) return

    const interval = setInterval(() => {
      loadData(false)
    }, pollingInterval)

    return () => clearInterval(interval)
  }, [loadData, isPaused, pollingInterval])

  // Timer para contador de "hace X segundos"
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceLastUpdate((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 bg-[#050505]">
        <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        <p className="text-white/40 font-medium text-sm tracking-widest uppercase animate-pulse">
          Inicializando panel de actividad...
        </p>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050505]">
        <div className="bg-white/[0.02] border border-red-500/20 max-w-lg w-full p-10 text-center rounded-[2rem] shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2 text-white">Error de Conexión</h2>
          <p className="text-white/40 text-sm mb-8">{error}</p>
          <button
            onClick={() => loadData(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-600/20"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  // Métricas calculadas
  const readyVideos = stats.assetsByStatus['ready'] || 0
  const processingVideos = stats.assetsByStatus['processing'] || 0
  const failedVideos = stats.assetsByStatus['failed'] || 0
  const pendingVideos = (stats.assetsByStatus['pending'] || 0) + (stats.assetsByStatus['uploaded'] || 0) + (stats.assetsByStatus['uploading'] || 0)
  const successRate = stats.storageStats?.successRate ?? (readyVideos + failedVideos > 0 ? Math.round((readyVideos / (readyVideos + failedVideos)) * 100) : 100)
  const totalDuration = stats.storageStats?.totalDurationSeconds ?? 0
  const queueStats = stats.queueStats || { active: 0, waiting: 0, completed: readyVideos, failed: failedVideos, delayed: 0, workersCount: 1 }

  // Servicios
  const services = stats.services
  const allServicesHealthy = services && Object.values(services).every((s) => s.status === 'healthy' || s.status === 'warning')

  // Telemetría Host y Proceso
  const host = stats.host || stats.systemInfo?.host
  const proc = stats.process || stats.systemInfo?.process
  const serverTime = stats.serverTime || stats.systemInfo?.serverTime
  const serverTimezone = stats.serverTimezone || stats.systemInfo?.serverTimezone || 'UTC'

  const hostCores = host?.cpus?.cores ?? 1
  const hostCpuModel = host?.cpus?.model ?? 'CPU del Host'
  const hostCpuPercent = host?.cpus?.usagePercent ?? 0
  const hostLoadAvg = host?.cpus?.loadAvg ?? [0, 0, 0]
  const hostLoadPercent = host?.cpus?.loadAvgPercent ?? Math.round((hostLoadAvg[0] / hostCores) * 100)

  const hostMemTotalMB = host?.memory?.totalMB ?? (stats.systemInfo?.memoryUsage?.rss ? stats.systemInfo.memoryUsage.rss * 4 : 1024)
  const hostMemUsedMB = host?.memory?.usedMB ?? (host?.memory?.totalMB && host?.memory?.freeMB ? host.memory.totalMB - host.memory.freeMB : 0)
  const hostMemFreeMB = host?.memory?.freeMB ?? (hostMemTotalMB > hostMemUsedMB ? hostMemTotalMB - hostMemUsedMB : 0)
  const hostMemUsedPercent = host?.memory?.usedPercent ?? (hostMemTotalMB > 0 ? Math.round((hostMemUsedMB / hostMemTotalMB) * 100) : 0)

  const procCpuPercent = proc?.cpuUsage?.usagePercent ?? 0
  const procUserSeconds = proc?.cpuUsage?.userSeconds ?? Math.round((stats.systemInfo.cpuUsage.user / 1e6) * 100) / 100
  const procSystemSeconds = proc?.cpuUsage?.systemSeconds ?? Math.round((stats.systemInfo.cpuUsage.system / 1e6) * 100) / 100
  const procTotalCpuSeconds = Math.round((procUserSeconds + procSystemSeconds) * 100) / 100

  const procRssMB = proc?.memoryUsage?.rss ?? stats.systemInfo.memoryUsage.rss
  const procHeapUsedMB = proc?.memoryUsage?.heapUsed ?? stats.systemInfo.memoryUsage.heapUsed
  const procHeapTotalMB = proc?.memoryUsage?.heapTotal ?? stats.systemInfo.memoryUsage.heapTotal
  const procExternalMB = proc?.memoryUsage?.external ?? stats.systemInfo.memoryUsage.external
  const procHeapPercent = proc?.memoryUsage?.heapUsedPercent ?? (procHeapTotalMB > 0 ? Math.round((procHeapUsedMB / procHeapTotalMB) * 100) : 0)

  const hostUptimeSec = host?.uptime ?? stats.systemInfo.uptime
  const procUptimeSec = proc?.uptime ?? stats.systemInfo.uptime

  // Items de auditoría paginados
  const auditItems = logs?.items || []
  const totalAuditItems = logs?.total ?? auditItems.length
  const totalPages = logs?.totalPages ?? Math.max(1, Math.ceil(totalAuditItems / pageSize))

  return (
    <div className="min-h-full pb-20 animate-fade-in bg-[#050505] space-y-10">

      {/* ENCABEZADO Y BARRA DE CONTROL DE TIEMPO REAL */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pt-4 border-b border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Actividad y Operaciones
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Admin Panel
            </span>
          </div>
          <p className="text-white/40 text-sm font-medium flex items-center gap-2">
            Supervisión operativa, estado de microservicios y auditoría en tiempo real.
          </p>
        </div>

        {/* Controles de Polling / Frecuencia */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
          {/* Indicador de Estado del Polling */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isPaused
                  ? 'bg-amber-400'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="text-[11px] font-mono text-white/70">
              {isPaused ? 'Pausado' : `Actualizando (${pollingInterval / 1000}s)`}
            </span>
          </div>

          {/* Selector de intervalo */}
          <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => {
                setPollingInterval(3000)
                setIsPaused(false)
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pollingInterval === 3000 && !isPaused
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              3s
            </button>
            <button
              onClick={() => {
                setPollingInterval(10000)
                setIsPaused(false)
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pollingInterval === 10000 && !isPaused
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              10s
            </button>
            <button
              onClick={() => {
                setPollingInterval(30000)
                setIsPaused(false)
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pollingInterval === 30000 && !isPaused
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              30s
            </button>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
              title={isPaused ? 'Reanudar actualización automática' : 'Pausar actualización automática'}
            >
              {isPaused ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Reanudar</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  <span>Pausar</span>
                </>
              )}
            </button>
          </div>

          {/* Botón de recarga manual */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 bg-white/[0.05] hover:bg-white/10 active:scale-95 border border-white/10 text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center group"
            title="Sincronizar ahora"
          >
            <svg
              className={`w-4 h-4 text-white/80 group-hover:text-white transition-transform ${
                refreshing ? 'animate-spin text-purple-400' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Hora Real del Servidor */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] font-mono">
            <span className="text-purple-300/60 font-sans uppercase tracking-wider text-[9px] font-bold">Servidor</span>
            <span className="text-purple-300 font-semibold">
              {serverTime
                ? new Date(serverTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '—'}
            </span>
            <span className="text-[10px] text-purple-400/50">({serverTimezone})</span>
          </div>

          <span className="text-[11px] text-white/30 font-medium px-2 hidden sm:inline" title="Tiempo transcurrido desde la última petición al backend">
            Sync hace {secondsSinceLastUpdate}s
          </span>
        </div>
      </div>

      {/* SECCIÓN 1: ESTADO VISIBLE DE SERVICIOS (API, PostgreSQL, Redis, S3, Worker) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-white/40 uppercase tracking-[0.25em]">
              Estado de Infraestructura y Servicios
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                allServicesHealthy
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}
            >
              {allServicesHealthy ? '5/5 Operativos' : 'Atención Requerida'}
            </span>
          </div>
          <span className="text-xs text-white/30 hidden sm:inline">
            Verificación activa en cada ciclo
          </span>
        </div>

        {services ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <ServiceStatusCard
              name={services.api.name}
              type="API Server"
              status={services.api.status}
              latencyMs={services.api.latencyMs}
              details={services.api.details}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              }
            />
            <ServiceStatusCard
              name={services.database.name}
              type="Base de Datos"
              status={services.database.status}
              latencyMs={services.database.latencyMs}
              details={services.database.details}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              }
            />
            <ServiceStatusCard
              name={services.redis.name}
              type="Cache & Queue"
              status={services.redis.status}
              latencyMs={services.redis.latencyMs}
              details={services.redis.details}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              }
            />
            <ServiceStatusCard
              name={services.s3.name}
              type="Storage de Video"
              status={services.s3.status}
              latencyMs={services.s3.latencyMs}
              details={services.s3.details}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
              }
            />
            <ServiceStatusCard
              name={services.worker.name}
              type="Transcoder FFmpeg"
              status={services.worker.status}
              latencyMs={services.worker.latencyMs}
              details={services.worker.details}
              badgeExtra={`${queueStats.active} activos`}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              }
            />
          </div>
        ) : (
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white/50 text-sm">
            Cargando estado de microservicios...
          </div>
        )}
      </section>

      {/* SECCIÓN 2: MÉTRICAS OPERATIVAS DEL PIPELINE Y COLA BULLMQ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-white/40 uppercase tracking-[0.25em]">
              Métricas Operativas del Pipeline
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Cola & Storage
            </span>
          </div>
          <span className="text-xs text-white/30 hidden sm:inline">
            BullMQ: {queueStats.workersCount} worker activo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Card 1: Videos y Pipeline */}
          <div className="bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {readyVideos} Listos
              </span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">Total Videos</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white tracking-tight">{stats.totalAssets}</p>
                <span className="text-xs text-white/40 font-mono">
                  ({readyVideos} listos · {processingVideos} proc · {failedVideos} fallidos)
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Tasa de Éxito de Transcodificación */}
          <div className="bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${successRate >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {successRate >= 90 ? 'Excelente' : 'Revisar'}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">Tasa de Éxito</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white tracking-tight">{successRate}%</p>
                <span className="text-xs text-white/40">efectividad de transcode</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cola BullMQ */}
          <div className="bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {queueStats.workersCount} Worker Activo
              </span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">Cola Transcodificación</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white tracking-tight">{queueStats.completed}</p>
                <span className="text-xs text-white/40 font-mono">
                  completados ({queueStats.active} act · {queueStats.waiting} esp · {queueStats.failed} fallidos)
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Tiempo de Contenido y Audiencia */}
          <div className="bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                Uptime Host {formatUptime(hostUptimeSec)}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">Duración Almacenada</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white tracking-tight">{formatDuration(totalDuration)}</p>
                <span className="text-xs text-white/40">
                  {stats.totalUsers} usuarios · {stats.totalViews} vistas
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: TELEMETRÍA REAL DE RECURSOS: HOST vs PROCESO FASTIFY */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-white/40 uppercase tracking-[0.25em]">
              Telemetría Real del Servidor
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Host vs Proceso API
            </span>
          </div>
          <p className="text-xs text-white/30">
            Mediciones directas del kernel Linux y del runtime V8 (sin valores inventados)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna 1: CPU DEL HOST vs CPU DEL PROCESO */}
          <div className="bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                    CPU del Sistema (Host)
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-white/50 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/5 truncate max-w-[150px]" title={hostCpuModel}>
                  {hostCores} núcleos · {hostCpuModel}
                </span>
              </div>

              {/* Barra de CPU Global */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50 font-medium">Uso Global del Host</span>
                  <span className="font-mono font-bold text-white">{hostCpuPercent}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(2, hostCpuPercent))}%` }}
                  />
                </div>
              </div>

              {/* Carga del Sistema (Load Average) */}
              <div className="p-3 rounded-2xl bg-white/[0.015] border border-white/5 space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Carga del Sistema (Load Avg)
                  </span>
                  <span className="text-[10px] font-mono text-purple-300 font-semibold">
                    {hostLoadPercent}% cap.
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-xs">
                  <div className="p-1.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[9px] text-white/30 block">1 min</span>
                    <span className="font-bold text-white">{hostLoadAvg[0]}</span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[9px] text-white/30 block">5 min</span>
                    <span className="font-bold text-white">{hostLoadAvg[1]}</span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[9px] text-white/30 block">15 min</span>
                    <span className="font-bold text-white">{hostLoadAvg[2]}</span>
                  </div>
                </div>
              </div>

              {/* Sub-bloque: CPU del Proceso Node.js */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs font-bold text-white/90">
                      Proceso Fastify API (PID {proc?.pid ?? 1})
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {procCpuPercent}% CPU
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-white/70 font-medium block">Tiempo Usuario (V8 Engine)</span>
                      <span className="text-[10px] text-white/30 block">Ejecución JS, serialización JSON</span>
                    </div>
                    <span className="font-mono font-bold text-white">{procUserSeconds}s</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-white/70 font-medium block">Tiempo Sistema (Kernel I/O)</span>
                      <span className="text-[10px] text-white/30 block">Llamadas Linux, red y sockets</span>
                    </div>
                    <span className="font-mono font-bold text-white">{procSystemSeconds}s</span>
                  </div>
                  <div className="flex justify-between items-center px-1 text-[11px] text-white/40">
                    <span>CPU acumulado por el proceso:</span>
                    <span className="font-mono font-semibold text-white/70">{procTotalCpuSeconds}s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna 2: MEMORIA DEL HOST vs MEMORIA DEL PROCESO */}
          <div className="bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                    Memoria RAM del Host
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  {hostMemUsedPercent}% Usada
                </span>
              </div>

              {/* Barra de Memoria Global */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50 font-medium">Uso de RAM Total</span>
                  <span className="font-mono font-bold text-white">
                    {formatBytes(hostMemUsedMB)} / {formatBytes(hostMemTotalMB)}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      hostMemUsedPercent > 85
                        ? 'bg-red-500'
                        : hostMemUsedPercent > 70
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, hostMemUsedPercent))}%` }}
                  />
                </div>
              </div>

              {/* Desglose Host: Total / Usada / Libre */}
              <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-xs mb-4">
                <div className="p-2 rounded-xl bg-white/[0.015] border border-white/5">
                  <span className="text-[9px] text-white/30 uppercase font-sans block mb-0.5">Total</span>
                  <span className="font-bold text-white">{formatBytes(hostMemTotalMB)}</span>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.015] border border-white/5">
                  <span className="text-[9px] text-white/30 uppercase font-sans block mb-0.5">Usada</span>
                  <span className="font-bold text-emerald-400">{formatBytes(hostMemUsedMB)}</span>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.015] border border-white/5">
                  <span className="text-[9px] text-white/30 uppercase font-sans block mb-0.5">Libre</span>
                  <span className="font-bold text-white/80">{formatBytes(hostMemFreeMB)}</span>
                </div>
              </div>

              {/* Sub-bloque: Memoria del Proceso Node.js (V8) */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-xs font-bold text-white/90">
                      Memoria del Proceso API
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-400">
                    Heap {procHeapPercent}%
                  </span>
                </div>

                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(3, procHeapPercent))}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-[10px] text-white/40 block mb-0.5">RSS (RAM Residente)</span>
                    <span className="font-mono font-bold text-white">{formatBytes(procRssMB)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-[10px] text-white/40 block mb-0.5">Heap Usado</span>
                    <span className="font-mono font-bold text-white">{formatBytes(procHeapUsedMB)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-[10px] text-white/40 block mb-0.5">Heap Total V8</span>
                    <span className="font-mono font-bold text-white/80">{formatBytes(procHeapTotalMB)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-[10px] text-white/40 block mb-0.5">Buffers / Externo</span>
                    <span className="font-mono font-bold text-white/80">{formatBytes(procExternalMB)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna 3: UPTIME COMPARATIVO Y HORA DEL SERVIDOR */}
          <div className="bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                    Tiempos de Actividad (Uptime)
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Estable
                </span>
              </div>

              {/* Uptime Host vs Uptime Proceso */}
              <div className="space-y-2 mb-5">
                <div className="p-3 rounded-2xl bg-white/[0.015] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">Uptime del Host (Linux)</span>
                    <span className="text-[10px] text-white/40 block">Tiempo ininterrumpido del sistema</span>
                  </div>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {formatUptime(hostUptimeSec)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.015] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">Uptime Proceso API</span>
                    <span className="text-[10px] text-white/40 block">
                      {proc?.nodeVersion ? `${proc.nodeVersion} · PID ${proc.pid}` : 'Fastify Server'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-white text-sm">
                    {formatUptime(procUptimeSec)}
                  </span>
                </div>
              </div>

              {/* Sub-bloque: Hora Real del Servidor y Sincronización */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-xs font-bold text-white/90">
                      Sincronización Temporal
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    {serverTimezone}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                      Hora del Servidor:
                    </span>
                    <span className="font-mono font-bold text-purple-300 text-base">
                      {serverTime
                        ? new Date(serverTime).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-white/40 border-t border-white/5 pt-1.5">
                    <span>Fecha ISO Servidor:</span>
                    <span className="font-mono text-white/70">
                      {serverTime ? new Date(serverTime).toISOString().slice(0, 10) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-white/40">
                    <span>Hora Local Cliente:</span>
                    <span className="font-mono text-white/70">
                      {new Date().toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-emerald-400/80 pt-1 border-t border-white/5">
                    <span>Estado Sincronización:</span>
                    <span className="font-medium">Activa (hace {secondsSinceLastUpdate}s)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: REGISTRO DE AUDITORÍA Y ACTIVIDAD EN TIEMPO REAL */}
      <section className="space-y-4 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Registro de Auditoría y Eventos
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Trazabilidad completa: actor, acción, recurso intervenido, resultado y metadata de ejecución.
            </p>
          </div>

          {/* Selector de límite por página */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value={10}>10 por pág</option>
              <option value={25}>25 por pág</option>
              <option value={50}>50 por pág</option>
            </select>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5">
          {/* Input de búsqueda */}
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por actor, email, título de video, ID o acción..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Chips de tipo de evento */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setTypeFilter('all')
                setCurrentPage(1)
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                typeFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
              }`}
            >
              Todos ({totalAuditItems})
            </button>
            <button
              onClick={() => {
                setTypeFilter('assets')
                setCurrentPage(1)
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                typeFilter === 'assets'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
              }`}
            >
              Videos
            </button>
            <button
              onClick={() => {
                setTypeFilter('users')
                setCurrentPage(1)
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                typeFilter === 'users'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
              }`}
            >
              Usuarios
            </button>
            <button
              onClick={() => {
                setTypeFilter('failed')
                setCurrentPage(1)
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                typeFilter === 'failed'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
              }`}
            >
              Errores / Fallidos
            </button>
          </div>
        </div>

        {/* Tabla de Eventos de Auditoría */}
        <div className="bg-white/[0.02] rounded-[2rem] border border-white/5 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01] text-white/40 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-4 px-6">Fecha / Hora</th>
                  <th className="py-4 px-6">Actor</th>
                  <th className="py-4 px-6">Acción</th>
                  <th className="py-4 px-6">Recurso Afectado</th>
                  <th className="py-4 px-6">Resultado</th>
                  <th className="py-4 px-6 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditItems.length > 0 ? (
                  auditItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedAuditItem(item)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      {/* Fecha / Hora */}
                      <td className="py-4 px-6 shrink-0 whitespace-nowrap">
                        <div className="font-mono text-white/80">
                          {new Date(item.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </div>
                        <div className="text-[10px] text-white/40">
                          {new Date(item.timestamp).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short'
                          })}{' '}
                          · {timeAgo(item.timestamp)}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-600/10 border border-purple-500/20 text-purple-300 font-bold flex items-center justify-center shrink-0">
                            {item.actor.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate max-w-[140px]">
                              {item.actor.name}
                            </p>
                            <span className="text-[10px] text-white/40 truncate block max-w-[140px]">
                              {item.actor.email || 'Sistema'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="py-4 px-6">
                        <span className="font-semibold text-white/90 block">
                          {item.actionLabel}
                        </span>
                        <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">
                          {item.action}
                        </span>
                      </td>

                      {/* Recurso */}
                      <td className="py-4 px-6 max-w-[220px]">
                        <div className="flex items-center gap-2">
                          <span className="text-white/30 shrink-0">
                            {item.resource.type === 'asset' ? (
                              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            )}
                          </span>
                          <span className="truncate text-white font-medium" title={item.resource.title}>
                            {item.resource.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-white/30 block mt-0.5 truncate">
                          ID: {item.resource.id.slice(0, 12)}...
                        </span>
                      </td>

                      {/* Resultado */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-md uppercase font-bold tracking-widest border ${
                            statusBadgeClasses[item.status] || 'bg-white/5 text-white/60 border-white/10'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* Botón Ver Detalle */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAuditItem(item)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.03] group-hover:bg-purple-600/20 text-white/70 group-hover:text-purple-300 border border-white/5 group-hover:border-purple-500/30 transition-all text-xs font-semibold"
                        >
                          Auditar →
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-white/40">
                      No se encontraron registros de auditoría coincidentes con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginación */}
          <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50 bg-white/[0.005]">
            <div>
              Mostrando{' '}
              <span className="font-bold text-white">
                {auditItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </span>{' '}
              a{' '}
              <span className="font-bold text-white">
                {Math.min(currentPage * pageSize, totalAuditItems)}
              </span>{' '}
              de <span className="font-bold text-white">{totalAuditItems}</span> eventos
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                ← Anterior
              </button>

              <span className="px-3 py-1 font-mono text-white/80">
                Pág. {currentPage} de {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL / DRAWER DE DETALLE DE AUDITORÍA */}
      {selectedAuditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div
            className="bg-[#0c0c0c] border border-white/10 max-w-2xl w-full rounded-[2rem] p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-white/5">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-widest font-bold">
                    {selectedAuditItem.action}
                  </span>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-md uppercase font-bold tracking-widest border ${
                      statusBadgeClasses[selectedAuditItem.status] || 'bg-white/5 text-white/60 border-white/10'
                    }`}
                  >
                    {selectedAuditItem.status}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {selectedAuditItem.actionLabel}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAuditItem(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Ficha Actor & Recurso */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Actor */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block">
                  Actor / Responsable
                </span>
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-400 text-lg">
                    {selectedAuditItem.actor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{selectedAuditItem.actor.name}</p>
                    <p className="text-xs text-white/40 truncate">{selectedAuditItem.actor.email || 'Proceso del Sistema'}</p>
                    <span className="text-[9px] uppercase font-mono text-purple-400 tracking-wider">
                      Rol: {selectedAuditItem.actor.role || 'system'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recurso */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block">
                  Recurso Intervenido
                </span>
                <div>
                  <p className="text-sm font-bold text-white truncate">{selectedAuditItem.resource.title}</p>
                  <p className="text-xs text-white/40 capitalize">Tipo: {selectedAuditItem.resource.type}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-white/40 truncate">
                      {selectedAuditItem.resource.id}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedAuditItem.resource.id, 'resource-id')}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold"
                    >
                      {copiedKey === 'resource-id' ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs space-y-1">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">
                Registro Temporal
              </span>
              <div className="flex justify-between items-center text-white/70">
                <span>Fecha exacta:</span>
                <span className="font-mono text-white font-medium">
                  {new Date(selectedAuditItem.timestamp).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' })}
                </span>
              </div>
              <div className="flex justify-between items-center text-white/70">
                <span>Tiempo transcurrido:</span>
                <span className="text-purple-400 font-semibold">{timeAgo(selectedAuditItem.timestamp)}</span>
              </div>
            </div>

            {/* Metadata estructurada */}
            {selectedAuditItem.metadata && Object.keys(selectedAuditItem.metadata).length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block">
                  Metadatos del Evento
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(selectedAuditItem.metadata).map(([key, val]) => (
                    <div key={key} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[10px] text-white/40 uppercase tracking-wider block font-medium truncate">
                        {key}
                      </span>
                      <span className="text-xs font-mono font-semibold text-white truncate block mt-0.5">
                        {typeof val === 'boolean'
                          ? val
                            ? 'Sí (true)'
                            : 'No (false)'
                          : val !== null && val !== undefined
                          ? String(val)
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* JSON Raw Inspector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                  Payload Completo (JSON)
                </span>
                <button
                  onClick={() => handleCopy(JSON.stringify(selectedAuditItem, null, 2), 'raw-json')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  {copiedKey === 'raw-json' ? 'JSON Copiado!' : 'Copiar JSON'}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-black/60 border border-white/5 text-[11px] font-mono text-white/70 overflow-x-auto max-h-48 custom-scrollbar">
                {JSON.stringify(selectedAuditItem, null, 2)}
              </pre>
            </div>

            {/* Footer Modal */}
            <div className="flex justify-end pt-4 border-t border-white/5">
              <button
                onClick={() => setSelectedAuditItem(null)}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ServiceStatusCard({
  name,
  type,
  status,
  latencyMs,
  details,
  icon,
  badgeExtra
}: {
  name: string
  type: string
  status: 'healthy' | 'degraded' | 'down' | 'warning'
  latencyMs: number
  details: string
  icon: React.ReactNode
  badgeExtra?: string
}) {
  const conf = serviceStatusClasses[status] || serviceStatusClasses['healthy']

  return (
    <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] text-white/80 border border-white/5 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {icon}
            </svg>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${conf.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot} ${status === 'healthy' ? 'animate-pulse' : ''}`} />
              <span>{conf.label}</span>
            </div>
            {badgeExtra && (
              <span className="text-[9px] font-mono text-white/40">
                {badgeExtra}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm font-bold text-white truncate">{name}</p>
        <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-2">{type}</p>
      </div>

      <div className="pt-3 border-t border-white/5 mt-2 flex items-center justify-between text-xs">
        <span className="font-mono text-[10px] text-white/50 truncate max-w-[130px]" title={details}>
          {details}
        </span>
        <span className="font-mono text-[10px] text-white/30 shrink-0">
          {latencyMs}ms
        </span>
      </div>
    </div>
  )
}
