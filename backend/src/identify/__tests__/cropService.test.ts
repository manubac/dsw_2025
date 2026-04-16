// cropService.test.ts
// Casos que rompen en producción:
//   1. Carta clara → devuelve buffer del warp (no el original)
//   2. Sin carta detectable → devuelve imagen reescalada sin tirar error
//   3. Buffer corrupto (cv.imdecode falla) → devuelve imagen reescalada sin tirar error

import 'reflect-metadata';

// ─── Mocks (deben declararse antes de cualquier import del módulo bajo test) ──

const WARPED_BUFFER   = Buffer.from('warped-result');
const FALLBACK_BUFFER = Buffer.from('fallback-result');
const PNG_BUFFER      = Buffer.from('png-intermediate');

// Mock sharp: encadena todo sobre la misma instancia
const sharpInstance = {
  toFormat:  jest.fn().mockReturnThis(),
  toBuffer:  jest.fn(),
  resize:    jest.fn().mockReturnThis(),
  normalise: jest.fn().mockReturnThis(),
  negate:    jest.fn().mockReturnThis(),
  extract:   jest.fn().mockReturnThis(),
  metadata:  jest.fn().mockResolvedValue({ width: 150, height: 210 }),
};
jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(sharpInstance),
}));

// Mat reutilizable: todos los métodos devuelven this mismo objeto.
// findContours se configura por test.
let mockSmallMat: any;
let mockOriginalMat: any;

jest.mock('opencv4nodejs', () => {
  class Point2 { constructor(public x: number, public y: number) {} }
  class Size   { constructor(public w: number, public h: number) {} }

  const cvMock = {
    imdecode:               jest.fn(),
    imencode:               jest.fn().mockReturnValue(WARPED_BUFFER),
    getPerspectiveTransform: jest.fn().mockReturnValue({}),
    COLOR_BGR2GRAY: 6,
    INTER_AREA:     3,
    RETR_EXTERNAL:  0,
    CHAIN_APPROX_SIMPLE: 2,
    Point2,
    Size,
  };
  return { __esModule: true, default: cvMock };
});

import cv   from 'opencv4nodejs';
import sharp from 'sharp';
import { crop } from '../services/cropService';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // smallMat: resultado de original.resize() — dimensiones al 50%
  mockSmallMat = {
    rows: 420,
    cols: 300,
    cvtColor:     jest.fn().mockReturnThis(),
    gaussianBlur: jest.fn().mockReturnThis(),
    canny:        jest.fn().mockReturnThis(),
    findContours: jest.fn().mockReturnValue([]),  // sin contornos por defecto
  };

  // originalMat: lo que devuelve cv.imdecode
  mockOriginalMat = {
    rows: 840,
    cols: 600,
    resize:          jest.fn().mockReturnValue(mockSmallMat),
    warpPerspective: jest.fn().mockReturnValue(mockSmallMat),
  };

  (cv.imdecode   as jest.Mock).mockReturnValue(mockOriginalMat);
  (cv.imencode   as jest.Mock).mockReturnValue(WARPED_BUFFER);

  // sharp: primera llamada (bufferToMat) devuelve PNG; segunda (fallback) devuelve fallback
  sharpInstance.toBuffer
    .mockResolvedValueOnce(PNG_BUFFER)    // bufferToMat → png para imdecode
    .mockResolvedValueOnce(FALLBACK_BUFFER); // fallback → imagen reescalada
});

// ─── Helper: contorno válido para una carta Pokémon ──────────────────────────

function makeValidContour(imageArea: number) {
  // 20% del área → pasa el filtro del 15%
  // bounding box con ratio 0.70 (≈ carta Pokémon 63×88mm)
  return {
    area: imageArea * 0.20,
    arcLength: jest.fn().mockReturnValue(200),
    approxPolyDP: jest.fn().mockReturnValue([
      { x: 30,  y: 20  },  // TL
      { x: 240, y: 20  },  // TR  → ancho ≈ 210
      { x: 240, y: 320 },  // BR  → alto ≈ 300  ratio = 210/300 = 0.70 ✓
      { x: 30,  y: 320 },  // BL
    ]),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('cropService.crop()', () => {

  test('carta clara sobre fondo simple → aplica warpPerspective y devuelve buffer del warp', async () => {
    const totalArea = mockSmallMat.rows * mockSmallMat.cols; // 126 000
    mockSmallMat.findContours.mockReturnValue([makeValidContour(totalArea)]);

    const result = await crop(Buffer.from('valid-image'));

    expect(mockOriginalMat.warpPerspective).toHaveBeenCalledTimes(1);
    expect(cv.imencode).toHaveBeenCalledWith('.png', mockSmallMat);
    expect(result).toBe(WARPED_BUFFER);
  });

  test('sin carta detectable → devuelve imagen original reescalada a 600×840 sin tirar error', async () => {
    // findContours devuelve array vacío (configurado en beforeEach)

    const result = await crop(Buffer.from('no-card'));

    expect(mockOriginalMat.warpPerspective).not.toHaveBeenCalled();
    // Verifica que sharp.resize fue llamado con las dimensiones de salida estándar
    expect(sharpInstance.resize).toHaveBeenCalledWith(600, 840, { fit: 'fill' });
    expect(result).toBe(FALLBACK_BUFFER);
  });

  test('buffer corrupto (cv.imdecode falla) → devuelve fallback sin tirar error', async () => {
    (cv.imdecode as jest.Mock).mockImplementation(() => {
      throw new Error('not a valid PNG/JPEG');
    });

    const result = await crop(Buffer.from('corrupt'));

    await expect(Promise.resolve(result)).resolves.toBeInstanceOf(Buffer);
    expect(sharpInstance.resize).toHaveBeenCalledWith(600, 840, { fit: 'fill' });
    expect(result).toBe(FALLBACK_BUFFER);
  });

});
