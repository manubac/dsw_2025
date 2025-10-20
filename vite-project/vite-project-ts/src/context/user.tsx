import { createContext, useState, useContext, ReactNode } from 'react'

export interface User {
  id?: number
  name: string
  email: string
  password: string
  role?: string // 'user' o 'vendedor'
}

interface UserContextType {
  user: User | null
  login: (userData: User) => void
  logout: () => void
  updateUser: (updated: Partial<User>) => void
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

  return (
    <UserContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser debe usarse dentro de UserProvider')
  return context
}
