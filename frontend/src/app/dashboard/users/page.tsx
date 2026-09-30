'use client'

import { useState, useEffect } from 'react'
import { getUsers, createUser, updateUser, deleteUser, getUserContent, User } from '@/lib/api'
import { getS3Url } from '@/lib/s3'
import { Input } from '@/components/ui/Input'

const roleColors: Record<string, string> = {
  admin: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  editor: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  viewer: 'text-white/60 bg-white/5 border-white/10'
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer'
}

export default function UsersAdminPage() {
  const [filter, setFilter] = useState('all')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState({ email: '', name: '', password: '', role: 'viewer' })
  const [nameFocused, setNameFocused] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [roleFocused, setRoleFocused] = useState(false)
  const [selectedUserProfile, setSelectedUserProfile] = useState<User | null>(null)
  const [userAssets, setUserAssets] = useState<any[]>([])
  const [userCategories, setUserCategories] = useState<any[]>([])
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [filter])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    const result = await getUsers(1, 100, filter)
    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setUsers(result.data.data)
    }
    setLoading(false)
  }

  const handleCreate = () => {
    setEditingUser(null)
    setFormData({ email: '', name: '', password: '', role: 'viewer' })
    setShowModal(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({ email: user.email, name: user.name, password: '', role: user.role })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingUser) {
      const result = await updateUser(editingUser.id, formData)
      if (!result.error) {
        setShowModal(false)
        fetchUsers()
      }
    } else {
      const result = await createUser(formData)
      if (!result.error) {
        setShowModal(false)
        fetchUsers()
      }
    }
  }

  const handleDelete = async (userId: string) => {
    setUserToDelete(userId)
    setShowDeleteModal(true)
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    setDeleting(true)
    const result = await deleteUser(userToDelete)
    if (!result.error) {
      fetchUsers()
    }
    setDeleting(false)
    setShowDeleteModal(false)
    setUserToDelete(null)
  }

  const openUserProfile = async (user: User) => {
    setSelectedUserProfile(user)
    setLoadingProfile(true)
    const { data, error } = await getUserContent(user.id)
    if (data) {
      setUserAssets(data.assets.slice(0, 5))
      setUserCategories(data.categories.slice(0, 5))
    }
    setLoadingProfile(false)
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-full pb-20 animate-fade-in bg-[#050505]">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pt-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">
            Usuarios
          </h1>
          <p className="text-sm text-white/40">
            Gestiona accesos y privilegios del sistema.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:block text-right mr-2">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Total</p>
            <p className="text-xl font-semibold text-white">{users.length}</p>
          </div>
          <button
            onClick={handleCreate}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-all active:scale-95 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2.5} /></svg>
            Nuevo Usuario
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Buscar por email o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-purple-500/50 focus:bg-white/[0.04] focus:outline-none transition-all text-sm"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2} /></svg>
        </div>

        <div className="flex bg-white/[0.02] p-1 rounded-2xl border border-white/5 w-full md:w-auto shrink-0">
          {['all', 'admin', 'editor', 'viewer'].map((role) => (
            <button
              key={role}
              onClick={() => setFilter(role)}
              className={`px-5 py-2 rounded-xl text-xs font-semibold capitalize transition-all flex-1 md:flex-none ${filter === role ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
            >
              {role === 'all' ? 'Todos' : role}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex justify-center">
            <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-white/40 text-sm">No se encontraron usuarios.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors group">

                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                      {user.name}
                    </h4>
                    <p className="text-xs text-white/40 truncate mt-0.5">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 pl-4">
                  <div className="hidden md:block text-right">
                    <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-widest border ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </div>

                  <div className="hidden lg:block text-xs text-white/30 font-medium">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openUserProfile(user)} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors" title="Ver Perfil">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth={1.5} /></svg>
                    </button>
                    <button onClick={() => handleEdit(user)} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors" title="Editar">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth={1.5} /></svg>
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="p-2 hover:bg-red-500/10 rounded-full text-white/40 hover:text-red-400 transition-colors" title="Eliminar">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={1.5} /></svg>
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="relative bg-[#1c1c1e] border border-white/10 w-full max-w-md p-8 rounded-[2rem] animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <p className="text-sm text-white/40 mt-1">Configura las credenciales de acceso.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/30 focus:border-purple-500 focus:outline-none transition-all text-sm"
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/30 focus:border-purple-500 focus:outline-none transition-all text-sm"
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder={`Contraseña ${editingUser ? '(dejar en blanco para no cambiar)' : ''}`}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/30 focus:border-purple-500 focus:outline-none transition-all text-sm"
                />
              </div>
              <div>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-[#2c2c2e] border border-white/10 rounded-xl px-4 py-4 text-white focus:border-purple-500 focus:outline-none transition-all text-sm appearance-none"
                >
                  <option value="viewer">Viewer (Solo lectura)</option>
                  <option value="editor">Editor (Gestiona contenido)</option>
                  <option value="admin">Administrador (Acceso total)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 font-medium text-sm transition-all">
                  Cancelar
                </button>
                <button type="submit" className="flex-[2] py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95">
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedUserProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <div className="relative bg-[#1c1c1e] border border-white/10 w-full max-w-lg rounded-[2rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in fade-in zoom-in-95 duration-200">

            <div className="p-8 pb-6 border-b border-white/5 bg-white/[0.01] text-center relative">
              <button onClick={() => setSelectedUserProfile(null)} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2} /></svg>
              </button>

              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center font-bold text-white text-4xl shadow-lg mb-4">
                {selectedUserProfile.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">{selectedUserProfile.name}</h2>
              <p className="text-sm text-white/40 mt-1">{selectedUserProfile.email}</p>
              <div className="mt-4">
                <span className={`inline-flex text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border ${roleColors[selectedUserProfile.role]}`}>
                  {roleLabels[selectedUserProfile.role]}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {loadingProfile ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xs font-bold tracking-widest text-white/30 uppercase mb-4">Videos Subidos</h3>
                    {userAssets.length === 0 ? (
                      <p className="text-sm text-white/20">Sin actividad reciente.</p>
                    ) : (
                      <div className="space-y-3">
                        {userAssets.map(asset => (
                          <div key={asset.id} className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <div className="w-20 shrink-0 aspect-video rounded-lg bg-black overflow-hidden relative">
                              {asset.thumbnailKey ? (
                                <img src={getS3Url(asset.thumbnailKey)} alt={asset.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white truncate">{asset.title}</p>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">{asset.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold tracking-widest text-white/30 uppercase mb-4">Colecciones Creadas</h3>
                    {userCategories.length === 0 ? (
                      <p className="text-sm text-white/20">No ha creado colecciones.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {userCategories.map(cat => (
                          <div key={cat.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <p className="font-semibold text-sm text-white truncate">{cat.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-transparent" onClick={() => !deleting && setShowDeleteModal(false)} />

          <div className="relative bg-[#1c1c1e] border border-white/10 w-full max-w-sm rounded-[2rem] p-8 text-center animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Eliminar Usuario</h3>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">
              ¿Estás seguro de que deseas eliminar este usuario? No podrás deshacer esta acción.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDeleteUser}
                disabled={deleting}
                className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all"
              >
                {deleting ? 'Eliminando...' : 'Eliminar usuario'}
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
                disabled={deleting}
                className="w-full py-3.5 rounded-xl bg-transparent text-white/60 hover:text-white transition-all font-medium text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}