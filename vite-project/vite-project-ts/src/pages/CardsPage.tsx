import { useEffect, useState, useMemo } from "react";
import { useFilters } from "../hooks/useFilters";
import { ProductFilters } from "../components/ProductFilters";
import { fetchApi } from "../services/api";
import { useNavigate } from "react-router-dom";

interface CardGroup {
  groupKey: string;
  name: string;
  setName: string;
  setCode: string | null;
  cardNumber: string | null;
  rarity: string | null;
  thumbnail: string | null;
  publications: any[];
  allCities: string[];
}

function getMinPrice(group: CardGroup, city: string): number {
  const pubs = city === 'all'
    ? group.publications
    : group.publications.filter((p: any) =>
        (p.intermediarios || []).some((i: any) => i.direccion?.ciudad === city)
      );
  if (pubs.length === 0) return Infinity;
  return Math.min(...pubs.map((p: any) => p.price ?? 0));
}

export function CardsPage() {
  const [cartas, setCartas] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'cartas' | 'bundles'>('cartas');
  const { filters, setFilters } = useFilters();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCartas() {
      try {
        const [resCartas, resBundles] = await Promise.all([
          fetchApi('/api/cartas'),
          fetchApi('/api/itemsCarta'),
        ]);
        const jsonCartas = await resCartas.json();
        const jsonBundles = await resBundles.json();

        setCartas(jsonCartas.data ?? []);

        const bundleList = (jsonBundles.data ?? [])
          .filter((item: any) => Array.isArray(item.cartas) && item.cartas.length >= 2)
          .map((item: any) => ({
            id: item.id,
            title: item.title,
            thumbnail: item.thumbnail,
            price: item.price ?? 0,
            description: item.description,
            intermediarios: item.intermediarios,
            uploader: item.uploader,
            stock: 1,
            type: 'bundle',
            cartas: item.cartas,
          }));
        setBundles(bundleList);
      } catch (err) {
        console.error("Error al traer cartas:", err);
      }
    }
    fetchCartas();
  }, []);

  const gameCartas = useMemo(() =>
    cartas.filter(c => {
      const name = c.cartaClass?.name?.toLowerCase()
      if (name === filters.game) return true
      if (!c.cartaClass && filters.game === 'pokemon') return true
      return false
    })
  , [cartas, filters.game])

  const groups = useMemo<CardGroup[]>(() => {
    const groupMap = new Map<string, CardGroup>();

    for (const carta of gameCartas) {
      const setCode = carta.setCode || null;
      const cardNumber = carta.cardNumber || null;
      const rarity = carta.rarity || null;
      const name = carta.title || carta.name || '';

      const keyBase = setCode && cardNumber
        ? `${setCode.toLowerCase()}-${cardNumber.toLowerCase()}`
        : name.toLowerCase();
      const groupKey = `${keyBase}-${(rarity || '').toLowerCase()}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          groupKey,
          name,
          setName: carta.set || 'Unknown Set',
          setCode,
          cardNumber,
          rarity,
          thumbnail: carta.thumbnail || null,
          publications: [],
          allCities: [],
        });
      }

      const group = groupMap.get(groupKey)!;
      group.publications.push(carta);
      if (!group.thumbnail && carta.thumbnail) group.thumbnail = carta.thumbnail;

      const citiesFromThis: string[] = (carta.intermediarios || [])
        .map((i: any) => i.direccion?.ciudad)
        .filter(Boolean);
      for (const city of citiesFromThis) {
        if (!group.allCities.includes(city)) group.allCities.push(city);
      }
    }

    return Array.from(groupMap.values());
  }, [gameCartas]);

  const cities = useMemo(
    () => Array.from(new Set(groups.flatMap(g => g.allCities))).sort(),
    [groups]
  );

  const maxAvailablePrice = useMemo(() => {
    const prices = groups.flatMap(g => g.publications.map((p: any) => p.price ?? 0))
    if (prices.length === 0) return 10000
    return Math.max(10000, Math.ceil(Math.max(...prices) / 100) * 100)
  }, [groups])

  const baseGroups = useMemo(() => {
    const queryLower = filters.query.toLowerCase()
    const aliases: string[] = (filters.queryAliases as string[]) || []

    return groups.filter(group => {
      const inCity = filters.city === 'all' || group.allCities.includes(filters.city)
      if (!inCity) return false
      const minPrice = getMinPrice(group, filters.city)
      if (minPrice < filters.minPrice) return false
      if (minPrice > filters.maxPrice) return false
      if (filters.query) {
        const titleLower = group.name.toLowerCase()
        const titleMatch = titleLower.includes(queryLower)
        const aliasMatch = aliases.some(alias => titleLower.includes(alias.toLowerCase()))
        if (!titleMatch && !aliasMatch) return false
      }
      return true
    })
  }, [groups, filters.query, filters.queryAliases, filters.city, filters.minPrice, filters.maxPrice])

  const availableCollections = useMemo(() =>
    Array.from(new Set(baseGroups.map(g => g.setName).filter(Boolean))).sort() as string[]
  , [baseGroups])

  const collectionGroups = useMemo(() =>
    filters.collection === 'all'
      ? baseGroups
      : baseGroups.filter(g => g.setName === filters.collection)
  , [baseGroups, filters.collection])

  const availableRarities = useMemo(() =>
    Array.from(new Set(collectionGroups.map(g => g.rarity).filter(Boolean))).sort() as string[]
  , [collectionGroups])

  useEffect(() => {
    if (filters.collection !== 'all' && !availableCollections.includes(filters.collection)) {
      setFilters((prev: any) => ({ ...prev, collection: 'all', rarity: 'all' }))
    }
  }, [availableCollections, filters.collection])

  useEffect(() => {
    if (filters.rarity !== 'all' && !availableRarities.includes(filters.rarity)) {
      setFilters((prev: any) => ({ ...prev, rarity: 'all' }))
    }
  }, [availableRarities, filters.rarity])

  const filteredGroups = useMemo(() => {
    let result = filters.rarity === 'all'
      ? collectionGroups
      : collectionGroups.filter(g => g.rarity === filters.rarity)

    if (filters.sort === 'name-asc') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    } else if (filters.sort === 'name-desc') {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name))
    } else if (filters.sort === 'price-asc') {
      result = [...result].sort((a, b) => getMinPrice(a, filters.city) - getMinPrice(b, filters.city))
    } else if (filters.sort === 'price-desc') {
      result = [...result].sort((a, b) => getMinPrice(b, filters.city) - getMinPrice(a, filters.city))
    }

    return result
  }, [collectionGroups, filters.rarity, filters.sort, filters.city])

  const filteredBundles = useMemo(() => {
    return bundles.filter(b => {
      const inCity = filters.city === 'all' ||
        (b.intermediarios || []).some((i: any) => i.direccion?.ciudad === filters.city)
      if (!inCity) return false
      const price = b.price ?? 0
      if (price < filters.minPrice) return false
      if (price > filters.maxPrice) return false
      return true
    })
  }, [bundles, filters.city, filters.minPrice, filters.maxPrice])

  const handleGroupClick = (group: CardGroup) => {
    const matchingBundles = bundles.filter(bundle =>
      bundle.cartas?.some((c: any) =>
        group.cardNumber &&
        c.cardNumber === group.cardNumber &&
        c.setName === group.setName
      )
    );

    navigate('/group', {
      state: {
        group: {
          name: group.name,
          setName: group.setName,
          setCode: group.setCode,
          cardNumber: group.cardNumber,
          rarity: group.rarity,
          thumbnail: group.thumbnail,
        },
        publications: group.publications,
        bundles: matchingBundles,
        activeCity: filters.city,
      },
    });
  };

  return (
    <main className="min-h-screen bg-green-50 p-5">
      <h1>Cartas disponibles</h1>

      <ProductFilters
        cities={cities}
        collections={availableCollections}
        rarities={availableRarities}
        maxAvailablePrice={maxAvailablePrice}
      />

      {/* Vista toggle: Cartas / Bundles */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('cartas')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition shadow-sm ${
            viewMode === 'cartas'
              ? 'bg-primary text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          🃏 Cartas ({filteredGroups.length})
        </button>
        <button
          onClick={() => setViewMode('bundles')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition shadow-sm ${
            viewMode === 'bundles'
              ? 'bg-primary text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          📦 Bundles ({filteredBundles.length})
        </button>
      </div>

      {viewMode === 'cartas' && (
        filteredGroups.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">No se encontraron cartas.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredGroups.map(group => {
              const minPrice = getMinPrice(group, filters.city);
              const pubCount = filters.city === 'all'
                ? group.publications.length
                : group.publications.filter((p: any) =>
                    (p.intermediarios || []).some((i: any) => i.direccion?.ciudad === filters.city)
                  ).length;

              const displayTitle = [
                group.name,
                group.setCode || null,
                group.cardNumber || null,
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={group.groupKey}
                  onClick={() => handleGroupClick(group)}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow hover:shadow-md transition overflow-hidden text-left"
                >
                  <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
                    {group.thumbnail ? (
                      <img
                        src={group.thumbnail}
                        alt={group.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🃏</div>
                    )}
                  </div>
                  <div className="p-2 flex flex-col gap-1">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight">
                      {displayTitle}
                    </p>
                    {group.rarity && (
                      <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 w-fit">
                        {group.rarity}
                      </span>
                    )}
                    <p className="text-sm font-bold text-green-700 mt-1">
                      {minPrice === Infinity ? '—' : `Desde $${minPrice.toFixed(2)}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {pubCount} publicación{pubCount !== 1 ? 'es' : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {viewMode === 'bundles' && (
        filteredBundles.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">No se encontraron bundles.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredBundles.map(bundle => (
              <button
                key={bundle.id}
                onClick={() => navigate(`/bundle/${bundle.id}`)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow hover:shadow-md transition overflow-hidden text-left"
              >
                <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
                  {bundle.thumbnail ? (
                    <img
                      src={bundle.thumbnail}
                      alt={bundle.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>
                  )}
                </div>
                <div className="p-2 flex flex-col gap-1">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight">
                    {bundle.title}
                  </p>
                  <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 w-fit">
                    {bundle.cartas?.length ?? 0} cartas
                  </span>
                  <p className="text-sm font-bold text-green-700 mt-1">
                    ${(bundle.price ?? 0).toFixed(2)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </main>
  );
}
