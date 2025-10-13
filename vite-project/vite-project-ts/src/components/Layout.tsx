import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Cart } from "./Cart";

export function Layout() {
  return (
    <>
      <Header />
      <Cart />
        <Outlet />
      <Footer />
    </>
  );
}
