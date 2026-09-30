'use client'

import { useState, useCallback } from 'react'
import {
  getAssets as apiGetAssets,
  getAsset as apiGetAsset,
  createAsset as apiCreateAsset,
  deleteAsset as apiDeleteAsset,
  uploadAsset,
  processAsset as apiProcessAsset,
  type Asset,
} from '@/lib/api'

type UploadStatus = 'idle' | 'uploading' | 'complete' | 'processing' | 'ready' | 'failed'

interface UploadProgress {
  status: UploadStatus
  progress: number
  error?: string
}

interface UseAssetsReturn {
  assets: Asset[]
  loading: boolean
  error: string | null
  fetchAssets: () => Promise<void>
  getAsset: (assetId: string) => Promise<Asset | null>
  createAsset: (title: string) => Promise<Asset | null>
  deleteAsset: (assetId: string) => Promise<boolean>
  uploadVideo: (
    assetId: string,
    file: File,
    onProgress?: (progress: number) => void
  ) => Promise<boolean>
  processVideo: (assetId: string) => Promise<boolean>
  refreshAsset: (assetId: string) => Promise<void>
}

export function useAssets(): UseAssetsReturn {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await apiGetAssets()
    if (fetchError) {
      setError(fetchError)
    } else if (data) {
      setAssets(data.data || [])
    }
    setLoading(false)
  }, [])

  const getAsset = useCallback(async (assetId: string): Promise<Asset | null> => {
    const { data, error: fetchError } = await apiGetAsset(assetId)
    if (fetchError || !data) {
      return null
    }
    return data
  }, [])

  const createAsset = useCallback(async (title: string): Promise<Asset | null> => {
    const { data, error: createError } = await apiCreateAsset(title)
    if (createError || !data) {
      return null
    }
    setAssets((prev) => [data, ...prev])
    return data
  }, [])

  const deleteAsset = useCallback(async (assetId: string): Promise<boolean> => {
    const { error: deleteError } = await apiDeleteAsset(assetId)
    if (deleteError) {
      return false
    }
    setAssets((prev) => prev.filter((a) => a.id !== assetId))
    return true
  }, [])

  const refreshAsset = useCallback(async (assetId: string): Promise<void> => {
    const { data, error: fetchError } = await apiGetAsset(assetId)
    if (!fetchError && data) {
      setAssets((prev) => prev.map((a) => (a.id === assetId ? data : a)))
    }
  }, [])

  const uploadVideo = useCallback(
    async (assetId: string, file: File, onProgress?: (progress: number) => void): Promise<boolean> => {
      try {
        await uploadAsset(assetId, file, onProgress)
        return true
      } catch {
        return false
      }
    },
    []
  )

  const processVideo = useCallback(async (assetId: string): Promise<boolean> => {
    const { error: processError } = await apiProcessAsset(assetId)
    if (processError) {
      return false
    }
    return true
  }, [])

  return {
    assets,
    loading,
    error,
    fetchAssets,
    getAsset,
    createAsset,
    deleteAsset,
    uploadVideo,
    processVideo,
    refreshAsset,
  }
}
