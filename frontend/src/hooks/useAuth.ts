'use client'

import { useState, useEffect, useCallback } from 'react'
import { login as apiLogin, register as apiRegister, getMe } from '@/lib/api'

interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: 'admin' | 'editor' | 'viewer'
}

interface UseAuthReturn {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const decodeJwt = (token: string): User | null => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(jsonPayload)
    return {
      id: payload.sub || payload.id || payload.userId || '',
      email: payload.email || '',
      name: payload.name || payload.username || '',
      role: payload.role || 'viewer',
    }
  } catch {
    return null
  }
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('streamflow_token')
    if (token) {
      const decoded = decodeJwt(token)
      if (decoded) {
        setUser(decoded)
        getMe().then(({ data }) => {
          if (data) {
            setUser(data as User)
          }
        }).catch(() => {
          // Si falla getMe, mantener el usuario del JWT
        })
      } else {
        localStorage.removeItem('streamflow_token')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await apiLogin(email, password)
    if (error || !data) {
      return { success: false, error: error || 'Error al iniciar sesión' }
    }
    localStorage.setItem('streamflow_token', data.token)
    const decoded = decodeJwt(data.token)
    if (decoded) {
      setUser(decoded)
      getMe().then(({ data: meData }) => {
        if (meData) {
          setUser(meData as User)
        }
      })
    }
    return { success: true }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await apiRegister(email, password, name)
    if (error || !data) {
      return { success: false, error: error || 'Error al registrar la cuenta' }
    }
    localStorage.setItem('streamflow_token', data.token)
    const decoded = decodeJwt(data.token)
    if (decoded) {
      setUser(decoded)
      getMe().then(({ data: meData }) => {
        if (meData) {
          setUser(meData as User)
        }
      })
    }
    return { success: true }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('streamflow_token')
    setUser(null)
  }, [])

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  }
}
