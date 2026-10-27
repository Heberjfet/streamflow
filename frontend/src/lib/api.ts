export const getApiUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL
  if (typeof window !== 'undefined') {
    if (!envUrl || ((envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      const protocol = window.location.protocol
      return `${protocol}//${window.location.hostname}:3001`
    }
  }
  if (envUrl) {
    if (envUrl.startsWith('http://') || envUrl.startsWith('https://') || envUrl.startsWith('/')) {
      return envUrl
    }
    return envUrl
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    return `${protocol}//${window.location.hostname}:3001`
  }
  return 'http://localhost:3001'
}

const authHeader = (): HeadersInit => {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('streamflow_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface ApiResponse<T = unknown> {
  data?: T
  error?: string
}

const handleResponse = async <T>(res: Response): Promise<ApiResponse<T>> => {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    return { error: error.error || error.message || `HTTP ${res.status}` }
  }
  const text = await res.text()
  if (!text) return { data: undefined as T }
  const data = JSON.parse(text)
  return { data }
}

export const login = async (email: string, password: string) => {
  const res = await fetch(`${getApiUrl()}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse<{ token: string; user: { id: string; email: string; name: string; role: string } }>(res)
}

export const register = async (email: string, password: string, name: string) => {
  const res = await fetch(`${getApiUrl()}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  return handleResponse<{ token: string; user: { id: string; email: string; name: string; role: string } }>(res)
}

export const getMe = async (): Promise<ApiResponse<{ id: string; email: string; name: string; role: string }>> => {
  const res = await fetch(`${getApiUrl()}/v1/auth/me`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<{ id: string; email: string; name: string; role: string }>(res)
}

export interface Asset {
  id: string
  title: string
  description?: string
  categoryId?: string
  categoryIds?: string[]
  status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed'
  progress?: number
  playbackId?: string
  thumbnailKey?: string
  hlsManifestKey?: string
  duration?: number
  views?: number
  createdAt: string
  updatedAt: string
}

export const getAssets = async (): Promise<ApiResponse<{ data: Asset[]; page: number; limit: number }>> => {
  const res = await fetch(`${getApiUrl()}/v1/assets`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<{ data: Asset[]; page: number; limit: number }>(res)
}

export const getAsset = async (assetId: string): Promise<ApiResponse<Asset>> => {
  const res = await fetch(`${getApiUrl()}/v1/assets/${assetId}`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<Asset>(res)
}

export const createAsset = async (title: string): Promise<ApiResponse<Asset>> => {
  const res = await fetch(`${getApiUrl()}/v1/assets`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return handleResponse<Asset>(res)
}

export const deleteAsset = async (assetId: string): Promise<ApiResponse<void>> => {
  const res = await fetch(`${getApiUrl()}/v1/assets/${assetId}`, {
    method: 'DELETE',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  if (res.status === 204) return { data: undefined }
  return handleResponse<void>(res)
}

export const uploadAsset = (assetId: string, file: File, onProgress?: (p: number) => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })
    xhr.open('POST', `${getApiUrl()}/v1/assets/${assetId}/upload`)
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('streamflow_token')}`)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    const formData = new FormData()
    formData.append('file', file)
    xhr.send(formData)
  })
}

export const processAsset = async (assetId: string): Promise<ApiResponse<void>> => {
  const res = await fetch(`${getApiUrl()}/v1/assets/${assetId}/process`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: '{}',
  })
  return handleResponse<void>(res)
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
}

export const getCategories = async (): Promise<ApiResponse<Category[]>> => {
  const res = await fetch(`${getApiUrl()}/v1/categories`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<Category[]>(res)
}

export const createCategory = async (data: { name: string; description?: string }): Promise<ApiResponse<Category>> => {
  const res = await fetch(`${getApiUrl()}/v1/categories`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<Category>(res)
}

export const deleteCategory = async (categoryId: string): Promise<ApiResponse<void>> => {
  const res = await fetch(`${getApiUrl()}/v1/categories/${categoryId}`, {
    method: 'DELETE',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  if (res.status === 204) return { data: undefined }
  return handleResponse<void>(res)
}

export const updateAsset = async (assetId: string, data: { categoryId?: string; categoryIds?: string[]; title?: string; description?: string }): Promise<ApiResponse<Asset>> => {
  const res = await fetch(`${getApiUrl()}/v1/assets/${assetId}`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<Asset>(res)
}

export interface PlaybackResponse {
  manifestUrl: string
  thumbnailUrl?: string
  title?: string
  duration?: number
  playbackId?: string
  allowDownload?: boolean
}

export const getPlayback = async (playbackId: string): Promise<ApiResponse<PlaybackResponse>> => {
  const res = await fetch(`${getApiUrl()}/v1/playback/${playbackId}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  return handleResponse<PlaybackResponse>(res)
}

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: 'admin' | 'editor' | 'viewer'
  createdAt: string
  updatedAt: string
}

export interface UsersResponse {
  data: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const getUsers = async (page = 1, limit = 20, role?: string): Promise<ApiResponse<UsersResponse>> => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
  if (role && role !== 'all') params.append('role', role)
  const res = await fetch(`${getApiUrl()}/v1/users?${params.toString()}`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<UsersResponse>(res)
}

export const getUser = async (userId: string): Promise<ApiResponse<User>> => {
  const res = await fetch(`${getApiUrl()}/v1/users/${userId}`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<User>(res)
}

export const createUser = async (data: { email: string; name: string; password: string; role?: string }): Promise<ApiResponse<User>> => {
  const res = await fetch(`${getApiUrl()}/v1/users`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<User>(res)
}

export const updateUser = async (userId: string, data: { name?: string; email?: string; role?: string; password?: string }): Promise<ApiResponse<User>> => {
  const res = await fetch(`${getApiUrl()}/v1/users/${userId}`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<User>(res)
}

export const deleteUser = async (userId: string): Promise<ApiResponse<void>> => {
  const res = await fetch(`${getApiUrl()}/v1/users/${userId}`, {
    method: 'DELETE',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  if (res.status === 204) return { data: undefined }
  return handleResponse<void>(res)
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'warning';
  latencyMs: number;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface ServicesStatus {
  api: ServiceHealth;
  database: ServiceHealth;
  redis: ServiceHealth;
  s3: ServiceHealth;
  worker: ServiceHealth;
}

export interface AuditItem {
  id: string;
  timestamp: string;
  actor: {
    id?: string;
    name: string;
    email?: string;
    role?: string;
    isSystem?: boolean;
  };
  action: string;
  actionLabel: string;
  resource: {
    type: 'asset' | 'user' | 'system';
    id: string;
    title: string;
  };
  status: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}

export interface HostMetrics {
  uptime: number;
  platform: string;
  arch: string;
  release: string;
  cpus: {
    cores: number;
    model: string;
    speedMHz: number;
    loadAvg: [number, number, number];
    loadAvgPercent: number;
    usagePercent: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    totalMB: number;
    freeMB: number;
    usedMB: number;
    usedPercent: number;
  };
}

export interface ProcessMetrics {
  uptime: number;
  pid: number;
  nodeVersion: string;
  cpuUsage: {
    userMicroseconds: number;
    systemMicroseconds: number;
    userSeconds: number;
    systemSeconds: number;
    usagePercent: number;
  };
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    heapUsedPercent: number;
  };
}

export interface AdminStats {
  totalAssets: number;
  totalUsers: number;
  totalViews: number;
  serverTime?: string;
  serverTimezone?: string;
  assetsByStatus: Record<string, number>;
  recentAssets: Array<{
    id: string;
    title: string;
    status: string;
    views: number;
    createdAt: string;
  }>;
  queueStats?: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    workersCount: number;
  };
  storageStats?: {
    totalDurationSeconds: number;
    readyCount: number;
    failedCount: number;
    processingCount: number;
    successRate: number;
  };
  services?: ServicesStatus;
  host?: HostMetrics;
  process?: ProcessMetrics;
  systemInfo: {
    uptime: number;
    memoryUsage: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    cpuUsage: {
      user: number;
      system: number;
    };
    host?: HostMetrics;
    process?: ProcessMetrics;
    serverTime?: string;
    serverTimezone?: string;
  };
}

export interface AdminLogs {
  items?: AuditItem[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  assets: Array<{
    id: string;
    title: string;
    status: string;
    views: number;
    createdAt: string;
    updatedAt?: string;
  }>;
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  }>;
  timestamp: string;
}

export interface AdminLogsParams {
  limit?: number;
  page?: number;
  search?: string;
  type?: string;
  status?: string;
}

export const getAdminStats = async (): Promise<ApiResponse<AdminStats>> => {
  const res = await fetch(`${getApiUrl()}/v1/admin/stats`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<AdminStats>(res)
}

export const getAdminLogs = async (paramsOrLimit?: number | AdminLogsParams): Promise<ApiResponse<AdminLogs>> => {
  let queryString = '';
  if (typeof paramsOrLimit === 'number') {
    queryString = `?limit=${paramsOrLimit}`;
  } else if (paramsOrLimit && typeof paramsOrLimit === 'object') {
    const sp = new URLSearchParams();
    if (paramsOrLimit.limit) sp.set('limit', String(paramsOrLimit.limit));
    if (paramsOrLimit.page) sp.set('page', String(paramsOrLimit.page));
    if (paramsOrLimit.search) sp.set('search', paramsOrLimit.search);
    if (paramsOrLimit.type) sp.set('type', paramsOrLimit.type);
    if (paramsOrLimit.status) sp.set('status', paramsOrLimit.status);
    queryString = `?${sp.toString()}`;
  }
  const url = `${getApiUrl()}/v1/admin/logs${queryString}`
  const res = await fetch(url, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<AdminLogs>(res)
}

export const getUserContent = async (userId: string): Promise<ApiResponse<{ assets: Asset[]; categories: Category[] }>> => {
  const res = await fetch(`${getApiUrl()}/v1/admin/${userId}/content`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<{ assets: Asset[]; categories: Category[] }>(res)
}

export interface TranscodeProfile {
  quality: string
  width: number
  height: number
  bitrateKbps: number
  codec: 'h264' | 'h265'
  active: boolean
}

export interface EncoderOption {
  id: string
  label: string
  hardware: boolean
}

export interface AppSettings {
  transcodeProfiles: TranscodeProfile[]
  allowedExtensions: string[]
  encoder: string
  concurrency?: number | null
  ffmpegThreads?: number | null
  allowRegistration?: boolean
}

export interface SystemInfo {
  cpuCores: number
  cpuModel: string
  totalMemGB: number
  freeMemGB: number
  platform: string
  availableEncoders: EncoderOption[]
}

export const getPublicSettings = async (): Promise<ApiResponse<{ allowRegistration: boolean; hasUsers: boolean }>> => {
  const res = await fetch(`${getApiUrl()}/v1/settings/public`)
  return handleResponse<{ allowRegistration: boolean; hasUsers: boolean }>(res)
}

export const getSettings = async (): Promise<ApiResponse<AppSettings>> => {
  const res = await fetch(`${getApiUrl()}/v1/settings`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<AppSettings>(res)
}

export const getAdminSettings = async (): Promise<ApiResponse<AppSettings & { availableEncoders: EncoderOption[] }>> => {
  const res = await fetch(`${getApiUrl()}/v1/admin/settings`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<AppSettings & { availableEncoders: EncoderOption[] }>(res)
}

export const getAdminSystem = async (): Promise<ApiResponse<SystemInfo>> => {
  const res = await fetch(`${getApiUrl()}/v1/admin/system`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  return handleResponse<SystemInfo>(res)
}

export const updateAdminSettings = async (data: Partial<AppSettings>): Promise<ApiResponse<AppSettings>> => {
  const res = await fetch(`${getApiUrl()}/v1/admin/settings`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<AppSettings>(res)
}
