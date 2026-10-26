'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ShareDropdownProps {
  playbackId: string
  className?: string
  disabled?: boolean
}

export function ShareDropdown({ playbackId, className = '', disabled = false }: ShareDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const getPublicUrl = () => {
    return `${window.location.origin}/watch/${playbackId}`
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(event.target as Node) &&
        portalRef.current && !portalRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text)
    }
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return Promise.resolve()
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await copyToClipboard(getPublicUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
  }

  const dropdownContent = isOpen && showDropdown && (
    <div
      ref={portalRef}
      role="dialog"
      aria-label="Compartir video"
      className="fixed glass-card rounded-xl p-3 shadow-xl border border-white/10 z-[99999] w-72"
      style={{
        top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 8 : '50%',
        left: buttonRef.current
          ? Math.max(8, Math.min(buttonRef.current.getBoundingClientRect().right - 288, window.innerWidth - 296))
          : '50%'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Compartir video</h3>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar panel de compartir"
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-[var(--text-secondary)] mb-3">
        Cualquier persona con el link puede ver el video
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={getPublicUrl()}
          readOnly
          aria-label="Enlace público del video"
          className="min-w-0 flex-1 bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] truncate focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
        />
        <button
          type="button"
          onClick={handleCopy}
          aria-live="polite"
          className="shrink-0 px-3 py-2 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
        >
          {copied ? 'OK' : 'Copiar'}
        </button>
      </div>
    </div>
  )

  return (
    <div
      ref={wrapperRef}
      className={`relative flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] transition-colors hover:border-white/10 hover:bg-white/[0.06] focus-within:border-purple-400/40 focus-within:bg-white/[0.06] ${className}`}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label="Compartir video"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Compartir video"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false)
          } else {
            setShowDropdown(true)
            setIsOpen(true)
          }
        }}
        className="absolute inset-0 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-transparent text-white/70 outline-none transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:text-white/40 disabled:hover:text-white/40"
      >
        <svg
          aria-hidden="true"
          className="block h-6 w-6 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>

      {showDropdown && createPortal(dropdownContent, document.body)}
    </div>
  )
}
