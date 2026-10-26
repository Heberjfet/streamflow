'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UploadFormProps {
  onUploadComplete?: () => void
}

type Step = 1 | 2 | 3
type UploadStatus = 'idle' | 'uploading' | 'complete' | 'processing' | 'done' | 'error'

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [step, setStep] = useState<Step>(1)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>([])

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    import('@/lib/api')
      .then(({ getSettings }) =>
        getSettings().then(({ data }) => {
          if (data?.allowedExtensions?.length) setAllowedExtensions(data.allowedExtensions)
        })
      )
      .catch(() => {})
  }, [])

  const acceptAttr = allowedExtensions.length
    ? allowedExtensions.map((e) => '.' + e).join(',')
    : 'video/*'

  const resetForm = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    setStatus('idle')
    setProgress(0)
    setError(null)
    setVideoTitle('')
    setSelectedFile(null)
    setStep(1)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // --- NAVEGACIÓN Y SELECCIÓN DE ARCHIVO ---
  const handleFileSelect = useCallback((file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const allowed = allowedExtensions.length ? allowedExtensions : ['mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v']
    if (!allowed.includes(ext)) {
      setError(`Formato no permitido (.${ext || '?'}). Permitidos: ${allowed.join(', ')}.`)
      return
    }
    if (file.size > 10 * 1024 * 1024 * 1024) {
      setError('El tamaño del archivo debe ser menor a 10GB.')
      return
    }
    setSelectedFile(file)
    setError(null)
    if (!videoTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setVideoTitle(nameWithoutExt)
    }
    setStep(2) // Avanzamos al paso de título
  }, [videoTitle, allowedExtensions])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  // --- LÓGICA DE BACKEND INTACTA (Exactamente igual a tu archivo original) ---
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault() // Lo hacemos opcional porque en el paso 3 no usamos un tag <form>
    if (!selectedFile || !videoTitle.trim()) {
      setError('Please provide a title and select a video file')
      return
    }

    setStatus('uploading')
    setError(null)

    try {
      const { createAsset, processAsset, uploadAsset } = await import('@/lib/api')

      const { data: asset, error: createError } = await createAsset(videoTitle.trim())
      if (createError || !asset) {
        throw new Error(createError || 'Failed to create asset')
      }

      await uploadAsset(asset.id, selectedFile, setProgress)

      setProgress(100)
      setStatus('complete')

      const { error: processError } = await processAsset(asset.id)
      if (processError) {
        throw new Error(processError)
      }

      onUploadComplete?.()

      // Muestra el progreso real de transcodificación que reporta el worker.
      setStatus('processing')

      pollIntervalRef.current = setInterval(async () => {
        const { getAsset } = await import('@/lib/api')
        const polledAsset = await getAsset(asset.id)
        if (!polledAsset.data) return

        const { status, progress } = polledAsset.data

        if (status === 'ready') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          setProgress(100)
          setStatus('done')
        } else if (status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          setStatus('error')
          setError('La transcodificación falló. Revisá los registros del servidor e intentá nuevamente.')
        } else if (typeof progress === 'number') {
          setProgress(progress)
        }
      }, 3000)

    } catch (err) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }
  // -------------------------------------------------------------------------

  // Si está subiendo o terminó, mostramos la pantalla de carga limpia
  if (status !== 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center animate-in fade-in zoom-in-95">
        {(status === 'uploading' || status === 'processing' || status === 'complete') && (
          <>
            <div className="relative w-24 h-24 flex items-center justify-center mb-2">
              <svg className="w-full h-full -rotate-90">
                <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent"
                  strokeDasharray={276} strokeDashoffset={276 - (276 * progress) / 100}
                  className="text-[var(--primary)] transition-all duration-300" strokeLinecap="round" />
              </svg>
              <span className="absolute text-xl font-bold text-white">{progress}%</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white tracking-tight mb-1">
                {status === 'processing' ? 'Procesando en la nube...' : 'Subiendo contenido...'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">Mantén esta ventana abierta.</p>
            </div>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-2 border border-green-500/20">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-semibold text-white">¡Video publicado!</h3>
            <button onClick={resetForm} className="mt-4 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors border border-white/10">Subir otro video</button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-2 border border-red-500/20">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h3 className="text-xl font-semibold text-white">Error de Subida</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-xs">{error}</p>
            <button onClick={resetForm} className="mt-4 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors border border-white/10">Intentar de nuevo</button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center gap-2 mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step === s ? 'w-8 bg-[var(--primary)]' : 'w-2 bg-white/10'}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {step === 1 && (
          <div
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()}
            className={`text-center p-12 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 animate-in fade-in slide-in-from-right-4 ${isDragging ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
          >
            <input ref={fileInputRef} type="file" accept={acceptAttr} onChange={handleInputChange} className="hidden" />
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <h2 className="text-xl font-medium tracking-tight mb-2">Elegir contenido</h2>
            <p className="text-sm text-[var(--text-secondary)]">Arrastra tu video aquí o haz clic para buscar</p>
          </div>
        )}

        {step === 2 && (
          <div className="text-center max-w-sm mx-auto w-full animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Nombrar video</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-8">¿Cómo se llamará este activo en la plataforma?</p>

            <input
              autoFocus
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-center text-[var(--text-primary)] text-lg focus:border-[var(--primary)] focus:outline-none transition-all mb-6"
              placeholder="Ej. Episodio 1"
            />

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl font-medium text-[var(--text-secondary)] hover:text-white bg-white/5 transition-colors">Atrás</button>
              <button onClick={() => setStep(3)} disabled={!videoTitle} className="flex-1 py-3 bg-[var(--primary)] hover:opacity-90 text-black rounded-xl font-semibold transition-all disabled:opacity-50">Continuar</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in zoom-in-95 max-w-md mx-auto w-full text-center">
            <h2 className="text-xl font-semibold tracking-tight mb-6">Confirmar Publicación</h2>
            <div className="bg-black border border-white/10 rounded-2xl overflow-hidden mb-8 relative aspect-video flex flex-col justify-end p-5 text-left">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
              <div className="relative z-20">
                <h3 className="text-lg font-bold text-white line-clamp-1">{videoTitle}</h3>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl font-medium text-[var(--text-secondary)] hover:text-white bg-white/5 transition-colors">Editar</button>
              <button onClick={() => handleSubmit()} className="flex-1 py-3 bg-[var(--primary)] hover:opacity-90 text-black rounded-xl font-semibold transition-all">Subir Video</button>
            </div>
          </div>
        )}
      </div>

      {error && step === 1 && (
        <p className="text-center text-sm text-red-400 mt-6 bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>
      )}
    </div>
  )
}