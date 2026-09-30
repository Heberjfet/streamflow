'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import hls from 'hls.js'
import { fixS3Hostname } from '@/lib/s3'

interface VideoPlayerProps {
  src: string
  poster?: string
  autoplay?: boolean
  playbackId?: string
}


export function VideoPlayer({ src, poster, autoplay = false, playbackId }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<hls | null>(null)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCenterIcon, setShowCenterIcon] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [qualityLevels, setQualityLevels] = useState<{ height: number; index: number }[]>([])
  const [currentQuality, setCurrentQuality] = useState(-1)

  const [videoSrc, setVideoSrc] = useState(src)
  const [posterImg, setPosterImg] = useState(poster)

  useEffect(() => {
    setVideoSrc(fixS3Hostname(src))
    setPosterImg(poster ? fixS3Hostname(poster) : undefined)
  }, [src, poster])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return

    setIsLoading(true)
    setError(null)

    if (hlsRef.current) {
      hlsRef.current.destroy()
    }

    if (videoSrc.includes('.m3u8')) {
      if (hls.isSupported()) {
        const hlsInstance = new hls({
          lowLatencyMode: true,
          backBufferLength: 90
        })
        hlsRef.current = hlsInstance

        hlsInstance.loadSource(videoSrc)
        hlsInstance.attachMedia(video)

        hlsInstance.on(hls.Events.MANIFEST_PARSED, (_, data) => {
          setIsLoading(false)
          if (autoplay) {
            video.play().catch(() => {
              video.muted = true
              setIsMuted(true)
              video.play().catch(() => {})
            })
          }
          const levels = hlsInstance.levels.map((level, index) => ({
            height: level.height,
            index
          }))
          setQualityLevels(levels)
        })

        hlsInstance.on(hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setError('Error fatal cargando el stream HLS')
            setIsLoading(false)
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoSrc
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false)
          if (autoplay) {
            video.play().catch(() => {
              video.muted = true
              setIsMuted(true)
              video.play().catch(() => {})
            })
          }
        })
      } else {
        setError('Tu navegador no soporta reproducción HLS')
        setIsLoading(false)
      }
    } else {
      video.src = videoSrc
      setIsLoading(false)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [videoSrc, autoplay])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => { })
      setIsPlaying(true)
      setShowCenterIcon(false)
    } else {
      video.pause()
      setIsPlaying(false)
      setShowCenterIcon(true)
      setShowControls(true)
    }
  }, [])

  const skipTime = useCallback((amount: number) => {
    const video = videoRef.current
    if (!video) return
    const newTime = Math.max(0, Math.min(video.currentTime + amount, video.duration || 0))
    video.currentTime = newTime
    setCurrentTime(newTime)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(err => console.error(`Error fullscreen: ${err.message}`))
    } else {
      await document.exitFullscreen().catch(err => console.error(`Error exit fullscreen: ${err.message}`))
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'KeyF':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'ArrowRight':
          e.preventDefault()
          skipTime(10)
          break
        case 'ArrowLeft':
          e.preventDefault()
          skipTime(-10)
          break
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('keydown', handleKeyDown)
      return () => container.removeEventListener('keydown', handleKeyDown)
    }
  }, [togglePlay, toggleFullscreen, skipTime])

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)

    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => {
        setShowControls(false)
        setShowQualityMenu(false)
      }, 3000)
    }
  }, [isPlaying])

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false)
      setShowQualityMenu(false)
    }
  }

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [isPlaying])

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const newVolume = parseFloat(e.target.value)
    video.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const time = parseFloat(e.target.value)
    video.currentTime = time
    setCurrentTime(time)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden flex items-center justify-center outline-none ${!showControls && isFullscreen ? 'cursor-none' : 'cursor-default'
        }`}
      onDoubleClick={toggleFullscreen}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        poster={posterImg}
        onClick={togglePlay}
        onPlay={() => {
          setIsPlaying(true)
          setShowCenterIcon(false)
        }}
        onPause={() => {
          setIsPlaying(false)
          setShowCenterIcon(true)
        }}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        playsInline
      />

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface)]/60 backdrop-blur-sm z-10 pointer-events-none">
          <div className="w-12 h-12 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(168,85,247,0.5)] mb-4" />
          <p className="text-[var(--primary)] font-mono text-xs tracking-widest uppercase animate-pulse">Buffer...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3 border border-red-500/50">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <p className="text-red-400 font-mono text-sm uppercase tracking-widest">{error}</p>
        </div>
      )}

      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-10 transition-all duration-500 ${showCenterIcon ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <button
          onClick={togglePlay}
          className="pointer-events-auto w-24 h-24 flex items-center justify-center rounded-full 
            bg-black/40 text-white backdrop-blur-sm border border-white/10
            hover:scale-105 hover:bg-black/60
            transition-all duration-200"
        >
          {isPlaying ? (
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-12 h-12 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      <div className={`absolute top-6 right-6 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="glass-card flex items-center h-12 px-4 rounded-2xl gap-3 border border-white/10 bg-black/40 backdrop-blur-md">
          <button onClick={toggleMute} className="text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors shrink-0">
            {isMuted || volume === 0 ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            )}
          </button>

          <div className="w-20 flex items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full h-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-full appearance-none cursor-pointer accent-[var(--primary)]"
              style={{
                background: `linear-gradient(to right, var(--primary) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className={`absolute bottom-6 left-6 right-6 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="glass-card flex items-center justify-between w-full h-16 px-6 rounded-2xl gap-6 border border-white/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => skipTime(-10)}
              className="text-[var(--text-secondary)] hover:text-white transition-colors p-1"
              title="Atrasar 10s"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 1 1 2.3 5.7" />
                <polyline strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points="4 4 4 10 10 10" />
                <text x="12" y="16" textAnchor="middle" fontSize="8" fill="currentColor">10</text>
              </svg>
            </button>

            <button onClick={togglePlay} className="text-white hover:text-[var(--primary)] transition-colors px-1 shrink-0">
              {isPlaying ? (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => skipTime(10)}
              className="text-[var(--text-secondary)] hover:text-white transition-colors p-1"
              title="Adelantar 10s"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 1 0-2.3 5.7" />
                <polyline strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points="20 4 20 10 14 10" />
                <text x="12" y="16" textAnchor="middle" fontSize="8" fill="currentColor">10</text>
              </svg>
            </button>
          </div>

          <div className="flex-1 flex items-center gap-4 min-w-0">
            <span className="text-xs text-[var(--text-secondary)] font-mono w-12 text-right shrink-0">{formatTime(currentTime)}</span>

            <div className="relative flex-1 h-2 bg-white/20 border border-[var(--border)] rounded-full flex items-center cursor-pointer overflow-hidden">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="absolute left-0 top-0 bottom-0 bg-[var(--primary)] pointer-events-none transition-all duration-100 ease-linear shadow-[0_0_10px_var(--primary)]"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            <span className="text-xs text-[var(--text-secondary)] font-mono w-12 shrink-0">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-4 shrink-0">

            {qualityLevels.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="flex items-center gap-1 text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors shrink-0 font-bold text-sm"
                  title="Calidad"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-4 glass-card rounded-2xl py-3 min-w-[140px] border border-white/10 bg-black/80 backdrop-blur-lg shadow-2xl">
                    <button
                      onClick={() => {
                        if (hlsRef.current) {
                          hlsRef.current.currentLevel = -1
                          setCurrentQuality(-1)
                        }
                        setShowQualityMenu(false)
                      }}
                      className={`w-full px-5 py-2.5 text-sm font-semibold text-left hover:bg-white/10 transition-colors ${currentQuality === -1 ? 'text-[var(--primary)]' : 'text-white'}`}
                    >
                      Auto
                    </button>
                    {[...qualityLevels].reverse().map((level) => (
                      <button
                        key={level.index}
                        onClick={() => {
                          if (hlsRef.current) {
                            hlsRef.current.currentLevel = level.index
                            setCurrentQuality(level.index)
                          }
                          setShowQualityMenu(false)
                        }}
                        className={`w-full px-5 py-2.5 text-sm font-medium text-left hover:bg-white/10 transition-colors ${currentQuality === level.index ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`}
                      >
                        {level.height}p
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="w-px h-6 bg-white/20 mx-1" />

            <button onClick={toggleFullscreen} className="text-[var(--text-primary)] hover:text-white transition-colors shrink-0">
              {isFullscreen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}