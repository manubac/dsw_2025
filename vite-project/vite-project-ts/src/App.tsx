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
import { Reservar } from "./pages/Reservar";
import Purchases from "./pages/Purchases";
import { CardDetail } from "./pages/CardDetail";
import { BundleDetail } from "./pages/BundleDetail";
import PublicarCartaPage from "./pages/PublicarCarta";
import { ContactPage } from "./pages/ContactPage";
import EditarCartaPage from "./pages/EditarCartaPage";
import EditarItemPage from "./pages/EditarItemPage";
import IntermediarioDashboard from "./pages/IntermediarioDashboard";
import MisPublicacionesPage from "./pages/MisPublicacionesPage";
import MisVentasPage from "./pages/MisVentasPage";
import { VendedorProfile } from "./pages/VendedorProfile";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { PagoExitoso } from "./pages/pagoExitoso";
import WishlistPage from "./pages/WishlistPage";

/* ✅ NUEVO — páginas de resultado de pago */
import PagoError from "./pages/pagoError";
import PagoPendiente from "./pages/pagoPendiente";

/* DEV — debug de detección de polígonos */
import DebugCropPage from "./pages/DebugCropPage";

/**
 * RUTA PROTEGIDA
 */
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * RUTA PROTEGIDA PARA VENDEDORES
 */
function VendedorRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "vendedor") {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * RUTA PROTEGIDA PARA INTERMEDIARIOS
 */
function IntermediarioRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "intermediario") {
    return <Navigate to="/" replace />;
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
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
                <Route path="reset-password" element={<ResetPasswordPage />} />

                {/* Sección de cartas */}
                <Route path="cards" element={<CardsPage />} />
                <Route path="card/:id" element={<CardDetail />} />
                <Route path="bundle/:id" element={<BundleDetail />} />

                {/* Perfil Público de Vendedor */}
                <Route path="vendedor/:id" element={<VendedorProfile />} />

                {/* Perfil protegido */}
                <Route
                  path="profile"
                  element={
                    <ProtectedRoute>
                      <UserProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* Checkout — deshabilitado temporalmente */}
                <Route path="checkout" element={<Navigate to="/" replace />} />

                {/* Reservar */}
                <Route
                  path="reservar"
                  element={
                    <ProtectedRoute>
                      <Reservar />
                    </ProtectedRoute>
                  }
                />

                {/* Wishlist */}
                <Route
                  path="wishlist"
                  element={
                    <ProtectedRoute>
                      <WishlistPage />
                    </ProtectedRoute>
                  }
                />

                {/* Mis compras */}
                <Route
                  path="purchases"
                  element={
                    <ProtectedRoute>
                      <Purchases />
                    </ProtectedRoute>
                  }
                />

                {/* Publicar */}
                <Route
                  path="publicar"
                  element={
                    <ProtectedRoute>
                      <PublicarCartaPage />
                    </ProtectedRoute>
                  }
                />

                {/* Editar carta */}
                <Route
                  path="editar-carta"
                  element={
                    <ProtectedRoute>
                      <EditarCartaPage />
                    </ProtectedRoute>
                  }
                />

                {/* Editar item */}
                <Route
                  path="editar-item"
                  element={
                    <ProtectedRoute>
                      <EditarItemPage />
                    </ProtectedRoute>
                  }
                />

                {/* Contacto */}
                <Route path="contact" element={<ContactPage />} />

                {/* Panel intermediario */}
                <Route
                  path="intermediario"
                  element={
                    <IntermediarioRoute>
                      <IntermediarioDashboard />
                    </IntermediarioRoute>
                  }
                />

                {/* Mis publicaciones */}
                <Route
                  path="mis-publicaciones"
                  element={
                    <VendedorRoute>
                      <MisPublicacionesPage />
                    </VendedorRoute>
                  }
                />

                <Route
                  path="mis-ventas"
                  element={
                    <VendedorRoute>
                      <MisVentasPage />
                    </VendedorRoute>
                  }
                />

                {/* ✅ RUTAS MERCADOPAGO (AGREGADAS) */}
                <Route path="pago-exitoso" element={<PagoExitoso />} />
                <Route path="pago-error" element={<PagoError />} />
                <Route path="pago-pendiente" element={<PagoPendiente />} />

                {/* Dev tools */}
                <Route path="debug-crop" element={<DebugCropPage />} />

                {/* Fallback */}
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