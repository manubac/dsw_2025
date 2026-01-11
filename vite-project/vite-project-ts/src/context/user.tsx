import { createContext, useState, useContext, ReactNode } from 'react'

export interface Direccion {
  id: number
  provincia: string
  ciudad: string
  codigoPostal: string
  calle: string
  altura: string
  departamento?: string
}

export interface User {
  id?: number
  name: string
  email: string
  password: string
  role?: string // 'user' o 'vendedor'
  direcciones?: Direccion[]
}

interface UserContextType {
  user: User | null
  login: (userData: User) => void
  logout: () => void
  updateUser: (updated: Partial<User>) => void
  addDireccion: (direccion: Direccion) => void
  removeDireccion: (id: number) => void
  loadDirecciones: () => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = (userData: User) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
  }

  const updateUser = (updated: Partial<User>) => {
    if (!user) return
    const updatedUser = { ...user, ...updated }
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  const addDireccion = (direccion: Direccion) => {
    if (!user) return
    const updatedUser = { ...user, direcciones: [...(user.direcciones || []), direccion] }
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  const removeDireccion = (id: number) => {
    if (!user) return
    const updatedUser = { ...user, direcciones: (user.direcciones || []).filter(d => d.id !== id) }
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  const loadDirecciones = async () => {
    if (!user?.id) return
    try {
      const queryParam = user.role === 'intermediario' ? 'intermediarioId' : 'usuarioId'
      const response = await fetch(`/api/direcciones?${queryParam}=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const direcciones = data.data || []
        updateUser({ direcciones })
      }
    } catch (error) {
      console.error('Error loading direcciones:', error)
    }
  }

  return (
    <UserContext.Provider value={{ user, login, logout, updateUser, addDireccion, removeDireccion, loadDirecciones }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser debe usarse dentro de UserProvider')
  return context
}
