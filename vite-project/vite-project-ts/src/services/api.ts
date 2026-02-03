import axios from 'axios'

export const API_URL = (import.meta.env.VITE_API_URL as string) || ''

export const api = axios.create({
  baseURL: API_URL ,
})

export const fetchApi = (path: string, options?: RequestInit) => {
  const base = API_URL || ''
  const url = path.startsWith('http') ? path : `${base}${path}`
  return fetch(url, options)
}

export default api
