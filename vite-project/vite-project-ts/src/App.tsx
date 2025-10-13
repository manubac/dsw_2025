import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { UserRegistration } from "./pages/UserRegistration";
import { CartProvider } from "./context/cart";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { CardsPage } from "./pages/CardsPage";
import { UserProfilePage } from "./pages/UserProfilePage"; 

function App() {
  return (
    <CartProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="register" element={<UserRegistration />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="cards" element={<CardsPage />} />
            <Route path="profile" element={<UserProfilePage />} /> 
          </Route>
        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;

