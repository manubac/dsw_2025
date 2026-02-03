// CardsPage.tsx
import { useEffect, useState } from "react";
import { useFilters } from "../hooks/useFilters";
import { Products } from "../components/Products";
import { ProductFilters } from "../components/ProductFilters";
import { fetchApi } from "../services/api";

export function CardsPage() {
  const [products, setProducts] = useState([]);
  const { filterProducts } = useFilters();

  useEffect(() => {
    async function fetchCartas() {
      try {
        const res = await fetchApi('/api/cartas');
        const json = await res.json();
        // Transform cartas data to match the expected format
        const transformedData = json.data.map((carta: any) => ({
          id: carta.id,
          title: carta.title,
          thumbnail: carta.thumbnail,
          price: typeof carta.price === 'string' ? parseFloat(carta.price.replace('$', '')) : carta.price,
          description: carta.description,
          intermediarios: carta.intermediarios, // Pass intermediarios to the product
          uploader: carta.uploader,
          stock: carta.stock, // Pass stock
        }));
        setProducts(transformedData);
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
