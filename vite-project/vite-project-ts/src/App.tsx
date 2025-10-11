import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { UserRegistration } from './pages/UserRegistration'
import { CartProvider } from './context/cart'
import { Layout } from './components/Layout'

function App() {
  return (
    <CartProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="register" element={<UserRegistration />} />
          </Route>
        </Routes>
      </Router>
    </CartProvider>
  )
}

export default App
