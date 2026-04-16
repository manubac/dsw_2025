// lookupService.test.ts
// Casos que rompen en producción:
//   1. confidence=high + nombre exacto en DB  → match: "exact"
//   2. Sin exact pero nombre fuzzy encontrado → match: "fuzzy"
//   3. Nada encontrado                         → match: "none", results: []
//   4. DB tira error                           → match: "none", sin propagación

import 'reflect-metadata';

// ─── Mock del ORM ─────────────────────────────────────────────────────────────
// Nota: la ruta es relativa al TEST FILE, no al service.
// La entity Carta se importa normalmente (no conecta a DB en import).

jest.mock('../../shared/db/orm.js', () => ({
  orm: {
    em: {
      fork: jest.fn(),
    },
  },
}));

import { orm }    from '../../shared/db/orm.js';
import { lookup } from '../services/lookupService';
import type { OcrInput } from '../services/lookupService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOcrInput(overrides: Partial<OcrInput> = {}): OcrInput {
  return {
    nombre:           'Charizard ex',
    codigoColeccion:  'SV04',
    numero:           '184',
    totalColeccion:   '198',
    claveLookup:      'SV04-184',
    confidence:       'high',
    ...overrides,
  };
}

function makeCarta(overrides: Record<string, unknown> = {}) {
  return {
    id:      1,
    name:    'Charizard ex',
    price:   '$45.00',
    image:   'https://example.com/charizard.jpg',
    link:    'https://example.com/charizard',
    rarity:  'Rare Holo',
    setName: 'Obsidian Flames',
    cartaClass: null,
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let mockEm: { findOne: jest.Mock; find: jest.Mock };

beforeEach(() => {
  mockEm = {
    findOne: jest.fn().mockResolvedValue(null),
    find:    jest.fn().mockResolvedValue([]),
  };
  (orm.em.fork as jest.Mock).mockReturnValue(mockEm);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('lookupService.lookup()', () => {

  test('confidence=high y nombre exacto en DB → match: "exact" con la carta encontrada', async () => {
    const carta = makeCarta();
    mockEm.findOne.mockResolvedValueOnce(carta);

    const result = await lookup(makeOcrInput({ confidence: 'high' }));

    expect(result.match).toBe('exact');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].nombre).toBe('Charizard ex');
    expect(result.results[0].precio).toBe(45);
    // Búsqueda fuzzy no debe haberse ejecutado
    expect(mockEm.find).not.toHaveBeenCalled();
  });

  test('nombre no encontrado exacto pero coincide por fuzzy → match: "fuzzy"', async () => {
    // findOne devuelve null → cae a fuzzy
    mockEm.findOne.mockResolvedValueOnce(null);
    mockEm.find.mockResolvedValueOnce([
      makeCarta({ name: 'Charizard ex', setName: 'Obsidian Flames' }),
      makeCarta({ id: 2, name: 'Charizard VSTAR', setName: 'Brilliant Stars' }),
    ]);

    const result = await lookup(makeOcrInput({ confidence: 'high' }));

    expect(result.match).toBe('fuzzy');
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.results.length).toBeLessThanOrEqual(5);
  });

  test('confidence=low omite exact, fuzzy sin resultados → match: "none", results: []', async () => {
    // confidence=low: findOne nunca se llama
    mockEm.find.mockResolvedValueOnce([]);

    const result = await lookup(makeOcrInput({ confidence: 'low' }));

    expect(result.match).toBe('none');
    expect(result.results).toEqual([]);
    expect(mockEm.findOne).not.toHaveBeenCalled();
  });

  test('DB tira error → no propaga el error, devuelve match: "none"', async () => {
    (orm.em.fork as jest.Mock).mockImplementation(() => {
      throw new Error('connection refused');
    });

    const result = await lookup(makeOcrInput());

    expect(result.match).toBe('none');
    expect(result.results).toEqual([]);
  });

  test('findOne tira error → no propaga el error, devuelve match: "none"', async () => {
    mockEm.findOne.mockRejectedValueOnce(new Error('query timeout'));

    const result = await lookup(makeOcrInput({ confidence: 'high' }));

    expect(result.match).toBe('none');
    expect(result.results).toEqual([]);
  });

});
