import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { UserRegistration } from "./pages/UserRegistration";
import { CartProvider } from "./context/cart";
import { FiltersProvider } from "./context/filters";
import { UserProvider } from "./context/user";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { CardsPage } from "./pages/CardsPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { Checkout } from "./pages/Checkout";
import { CardDetail } from "./pages/CardDetail"; 
import PublicarCartaPage from "./pages/PublicarCarta";

function App() {
  return (
    <UserProvider>
      <FiltersProvider>
        <CartProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="register" element={<UserRegistration />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="cards" element={<CardsPage />} />
                <Route path="card/:id" element={<CardDetail />} />
                <Route path="profile" element={<UserProfilePage />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="/publicar" element={<PublicarCartaPage />} />
              </Route>
            </Routes>
          </Router>
        </CartProvider>
      </FiltersProvider>
    </UserProvider>
  );
}

export default App;

