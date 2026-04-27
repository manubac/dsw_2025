import { useState } from 'react'
import { Hero } from '../components/Hero'
import { NovedadesCarousel } from '../components/NovedadesCarousel'
import { MejoresVendedoresSection } from '../components/MejoresVendedoresSection'
import { CardScanner, type ScannedCard } from '../components/CardScanner/CardScanner'
import { ScanLine } from 'lucide-react'

export function HomePage() {
  const [scannerOpen, setScannerOpen] = useState(false)

  const handleCardsScanned = (cards: ScannedCard[]) => {
    console.log('Cartas escaneadas:', cards)
  }

  return (
    <>
      <Hero />
      <NovedadesCarousel />
      <MejoresVendedoresSection />

      {/* Floating scanner button — bottom-right */}
      <button
        onClick={() => setScannerOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-semibold px-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
        aria-label="Escanear cartas"
      >
        <ScanLine size={18} />
        Escanear cartas
      </button>

      {scannerOpen && (
        <CardScanner
          onCardsScanned={handleCardsScanned}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  )
}
