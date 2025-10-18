import { useEffect, useState } from "react";
import { useFilters } from "../hooks/useFilters";
import { Products } from "../components/Products";
import { ProductFilters } from "../components/ProductFilters";

export function CardsPage() {
  const [products, setProducts] = useState([]);
  const { filterProducts } = useFilters();

  useEffect(() => {
    async function fetchCartas() {
      try {
        const res = await fetch("http://localhost:3000/cartas");
        const json = await res.json();
        setProducts(json.data); // tu backend devuelve { message, data }
      } catch (err) {
        console.error("Error al traer cartas:", err);
      }
    }

    fetchCartas();
  }, []);

  const filteredProducts = filterProducts(products || []);

  return (
    <main style={{ padding: "20px" }}>
      <h1>Cartas disponibles</h1>
      <ProductFilters />
      <Products products={filteredProducts} />
    </main>
  );
}
