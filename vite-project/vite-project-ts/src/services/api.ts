import axios from 'axios'

export const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000'

console.log('Frontend using API:', API_URL); // Debug para ver en consola

export const api = axios.create({
  baseURL: API_URL,
})

export const fetchApi = (path: string, options?: RequestInit) => {
  // Eliminar slash final de API_URL si existe y slash inicial de path si existe para evitar doble //
  const cleanBase = API_URL.replace(/\/$/, ""); 
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;
  
  const url = path.startsWith('http') ? path : `${cleanBase}/${cleanPath}`
  return fetch(url, options)
}

export default api
