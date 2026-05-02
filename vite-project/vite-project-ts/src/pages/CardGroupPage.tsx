import { useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";

type SortKey = 'price-asc' | 'price-desc' | 'rating-desc' | 'rating-asc';

const LANG_LABELS: Record<string, string> = {
  en: 'EN', es: 'ES', pt: 'PT', fr: 'FR', de: 'DE', it: 'IT', ru: 'RU', ja: 'JA',
};

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          className={star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}
          style={{ fontSize: '12px' }}
        >
          ★
        </span>
      ))}
      <span className="text-xs text-gray-400 ml-1">({count})</span>
    </div>
  );
}

export default function CardGroupPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as {
    group: {
      name: string;
      setName: string;
      setCode: string | null;
      cardNumber: string | null;
      rarity: string | null;
      thumbnail: string | null;
    };
    publications: any[];
    bundles: any[];
    activeCity: string;
  } | null;

  const [sort, setSort] = useState<SortKey>('price-asc');
  const [cityFilter, setCityFilter] = useState<string>(state?.activeCity || 'all');

  if (!state) {
    navigate('/cards', { replace: true });
    return null;
  }

  const { group, publications, bundles } = state;

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const pub of publications) {
      for (const inter of pub.intermediarios || []) {
        if (inter.direccion?.ciudad) set.add(inter.direccion.ciudad);
      }
    }
    return Array.from(set).sort();
  }, [publications]);

  const filteredPubs = useMemo(() => {
    if (cityFilter === 'all') return publications;
    return publications.filter((pub: any) =>
      (pub.intermediarios || []).some((i: any) => i.direccion?.ciudad === cityFilter)
    );
  }, [publications, cityFilter]);

  const sortedPubs = useMemo(() => {
    const arr = [...filteredPubs];
    if (sort === 'price-asc') arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sort === 'price-desc') arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    else if (sort === 'rating-desc') arr.sort((a, b) => (b.uploader?.rating ?? 0) - (a.uploader?.rating ?? 0));
    else if (sort === 'rating-asc') arr.sort((a, b) => (a.uploader?.rating ?? 0) - (b.uploader?.rating ?? 0));
    return arr;
  }, [filteredPubs, sort]);

  const displayTitle = [
    group.name,
    group.setCode || null,
    group.cardNumber || null,
  ].filter(Boolean).join(' ');

  return (
    <main className="min-h-screen bg-green-50 p-5">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        ← Volver
      </button>

      {/* Header */}
      <div className="flex gap-4 mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
        {group.thumbnail && (
          <img
            src={group.thumbnail}
            alt={group.name}
            className="w-24 h-32 object-contain rounded-xl shadow"
          />
        )}
        <div className="flex flex-col gap-1 justify-center">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">{displayTitle}</h1>
          {group.rarity && (
            <span className="text-sm bg-amber-100 text-amber-700 rounded px-2 py-0.5 w-fit">
              {group.rarity}
            </span>
          )}
          <p className="text-sm text-gray-500">
            {publications.length} publicación{publications.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="all">Todas las ciudades</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="price-asc">Precio: menor primero</option>
          <option value="price-desc">Precio: mayor primero</option>
          <option value="rating-desc">Mejor valorados</option>
          <option value="rating-asc">Menor valoración</option>
        </select>
      </div>

      {/* Publications list */}
      {sortedPubs.length === 0 ? (
        <p className="text-gray-500 text-center mt-8">Sin publicaciones en esta ciudad.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedPubs.map((pub: any) => {
            const lang = pub.lang || 'en';
            const isTienda = !!pub.uploaderTienda;
            const rating = pub.uploader?.rating ?? 0;
            const reviewsCount = pub.uploader?.reviewsCount ?? 0;
            const vendorName = isTienda
              ? pub.uploaderTienda.nombre
              : (pub.uploader?.nombre ?? 'Vendedor');
            const vendorPath = isTienda
              ? `/tienda/${pub.uploaderTienda.id}`
              : `/vendedor/${pub.uploader?.id}`;
            const pubCities = (pub.intermediarios || [])
              .map((i: any) => i.direccion?.ciudad)
              .filter(Boolean) as string[];

            return (
              <div
                key={pub.id}
                onClick={() => navigate(`/card/${pub.id}`)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition"
              >
                {pub.thumbnail && (
                  <img
                    src={pub.thumbnail}
                    alt={pub.title}
                    className="w-12 h-16 object-contain rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      onClick={(e) => { e.stopPropagation(); navigate(vendorPath); }}
                      className="font-semibold text-green-700 dark:text-green-400 text-sm cursor-pointer hover:underline"
                    >
                      {vendorName}
                    </span>
                    {isTienda && (
                      <span className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">
                        Tienda
                      </span>
                    )}
                    <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                      {LANG_LABELS[lang] || lang.toUpperCase()}
                    </span>
                    {pubCities.length > 0 && (
                      <span className="text-xs text-gray-400">{pubCities.join(', ')}</span>
                    )}
                  </div>
                  {!isTienda && <StarRating rating={rating} count={reviewsCount} />}
                  <p className="text-xs text-gray-400 mt-0.5">Stock: {pub.stock ?? 1}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-green-700">${(pub.price ?? 0).toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bundles section */}
      {bundles.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-3">
            Bundles que incluyen esta carta
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {bundles.map((bundle: any) => (
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
                <div className="p-2">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 line-clamp-2">
                    {bundle.title}
                  </p>
                  <p className="text-sm font-bold text-green-700 mt-1">
                    ${(bundle.price ?? 0).toFixed(2)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
