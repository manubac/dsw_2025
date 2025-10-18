import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { FiltersProvider } from './context/filters'
import { UserProvider } from './context/user'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <UserProvider>
    <FiltersProvider>
      <App />
    </FiltersProvider>
  </UserProvider>
)
