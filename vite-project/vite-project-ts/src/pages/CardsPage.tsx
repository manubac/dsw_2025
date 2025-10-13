import { useState } from "react";
import { products as initialProducts } from "../mocks/cartas.json";
import { useFilters } from "../hooks/useFilters";
import { Products } from "../components/Products";
import { ProductFilters } from "../components/ProductFilters";

export function CardsPage() {
  const [products] = useState(initialProducts);
  const { filterProducts } = useFilters();

  const filteredProducts = filterProducts(products);

  return (
    <main style={{ padding: "20px" }}>
      <h1>Todo el Stock</h1>
      <ProductFilters />
      <Products products={filteredProducts} />
    </main>
  );
}
