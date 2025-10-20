import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { UserRegistration } from "./pages/UserRegistration";
import { CartProvider } from "./context/cart";
import { FiltersProvider } from "./context/filters";
import { UserProvider, useUser } from "./context/user";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { CardsPage } from "./pages/CardsPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { Checkout } from "./pages/Checkout";
import { CardDetail } from "./pages/CardDetail";
import PublicarCartaPage from "./pages/PublicarCarta";
import { ContactPage } from "./pages/ContactPage";

/**
 * RUTA PROTEGIDA:
 * Bloquea el acceso a rutas que requieren autenticación.
 * Redirige al login si no hay usuario logueado.
 */
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <UserProvider>
      <FiltersProvider>
        <CartProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Layout />}>
                {/* Página principal */}
                <Route index element={<HomePage />} />

                {/* Autenticación */}
                <Route path="register" element={<UserRegistration />} />
                <Route path="login" element={<LoginPage />} />

                {/* Sección de cartas */}
                <Route path="cards" element={<CardsPage />} />
                <Route path="card/:id" element={<CardDetail />} />

                {/* Sección del perfil protegida */}
                <Route
                  path="profile"
                  element={
                    <ProtectedRoute>
                      <UserProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* Carrito y checkout */}
                <Route
                  path="checkout"
                  element={
                    <ProtectedRoute>
                      <Checkout />
                    </ProtectedRoute>
                  }
                />

                {/* Página de publicación (solo vendedores/intermediarios) */}
                <Route
                  path="publicar"
                  element={
                    <ProtectedRoute>
                      <PublicarCartaPage />
                    </ProtectedRoute>
                  }
                />

                {/* Contacto */}
                <Route path="contact" element={<ContactPage />} />

                {/* Ruta fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Router>
        </CartProvider>
      </FiltersProvider>
    </UserProvider>
  );
}

export default App;
