import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Cart } from "./Cart";
import ScrollBackground from "./ScrollBackground";

export function Layout() {
 return (
    <>
      <ScrollBackground />
      <Header />
      <Cart />
        <Outlet />
      <Footer />
    </>
  );
}