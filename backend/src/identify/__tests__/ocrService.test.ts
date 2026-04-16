// ocrService.test.ts
// Casos que rompen en producción:
//   1. Recuadro negro detectable → anclaEncontrada: true
//   2. Sin recuadro negro       → fallbackUsado: true, sin error
//   3. OCR devuelve "184/198"   → numero: "184", totalColeccion: "198"
//   4. OCR devuelve texto basura → confidence: "low", sin error

import 'reflect-metadata';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const MOCK_BUFFER = Buffer.from('mock-png');

// Mock sharp: todas las llamadas devuelven la misma instancia encadenada
const sharpInstance = {
  toFormat:  jest.fn().mockReturnThis(),
  toBuffer:  jest.fn().mockResolvedValue(MOCK_BUFFER),
  resize:    jest.fn().mockReturnThis(),
  normalise: jest.fn().mockReturnThis(),
  negate:    jest.fn().mockReturnThis(),
  extract:   jest.fn().mockReturnThis(),
  metadata:  jest.fn().mockResolvedValue({ width: 50, height: 20 }),
};
jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(sharpInstance),
}));

// Mock Tesseract: worker con setParameters + recognize configurables por test
let mockWorker: {
  setParameters: jest.Mock;
  recognize:     jest.Mock;
  terminate:     jest.Mock;
};
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
  OEM: { LSTM_ONLY: 1 },
  PSM: { SINGLE_LINE: 7 },
}));

// Mock OpenCV: mat autocontenido donde todos los métodos encadenados devuelven this.
// findContours se configura por test para simular presencia/ausencia del recuadro negro.
let mockMat: any;
jest.mock('opencv4nodejs', () => {
  const cvMock = {
    imdecode:           jest.fn(),
    COLOR_BGR2HSV:      40,
    RETR_EXTERNAL:      0,
    CHAIN_APPROX_SIMPLE: 2,
    THRESH_BINARY_INV:  1,
  };
  return { __esModule: true, default: cvMock };
});

import cv              from 'opencv4nodejs';
import { createWorker } from 'tesseract.js';
import { extractText, terminateWorker } from '../services/ocrService';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Nuevo worker mock para cada test
  mockWorker = {
    setParameters: jest.fn().mockResolvedValue(undefined),
    recognize:     jest.fn().mockResolvedValue({ data: { text: '' } }),
    terminate:     jest.fn().mockResolvedValue(undefined),
  };
  (createWorker as jest.Mock).mockResolvedValue(mockWorker);

  // Mat genérico: todos los métodos devuelven this
  mockMat = {
    cvtColor:     jest.fn().mockReturnThis(),
    splitChannels: jest.fn().mockReturnValue([null, null, null as any]),
    threshold:    jest.fn().mockReturnThis(),
    findContours: jest.fn().mockReturnValue([]),  // sin contornos por defecto
  };
  // splitChannels[2] es el canal V; threshold y findContours se aplican sobre él.
  // Como todo devuelve mockMat, el índice [2] debe también devolver mockMat:
  mockMat.splitChannels.mockReturnValue([mockMat, mockMat, mockMat]);

  (cv.imdecode as jest.Mock).mockReturnValue(mockMat);
});

// Resetear el worker singleton entre tests para que cada test cree uno nuevo
afterEach(async () => {
  await terminateWorker();
});

// ─── Helper: contorno ancla válido ───────────────────────────────────────────

function makeAnchorContour() {
  // aspectRatio = 50/20 = 2.5 (válido: 1–4)
  // area = 50*20 = 1000 (válido: > 50 y < 600*109*0.25 ≈ 16350)
  return {
    boundingRect: jest.fn().mockReturnValue({ x: 5, y: 3, width: 50, height: 20 }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ocrService.extractText()', () => {

  test('imagen con recuadro negro detectable → anclaEncontrada: true', async () => {
    mockMat.findContours.mockReturnValue([makeAnchorContour()]);

    const result = await extractText(MOCK_BUFFER);

    expect(result.debug.anclaEncontrada).toBe(true);
    expect(result.debug.fallbackUsado).toBe(false);
  });

  test('imagen sin recuadro negro → fallbackUsado: true, no tira error', async () => {
    // findContours devuelve [] (configurado en beforeEach)

    const result = await extractText(MOCK_BUFFER);

    expect(result.debug.fallbackUsado).toBe(true);
    expect(result.debug.anclaEncontrada).toBe(false);
  });

  test('OCR devuelve "184/198" → numero: "184", totalColeccion: "198"', async () => {
    // Hacer que el OCR de la zona de número devuelva "184/198".
    // recognize es llamado 3 veces (colección, número, nombre) en Promise.all.
    // Todas devuelven "184/198"; parseNumber extrae lo correcto del segundo resultado.
    mockWorker.recognize.mockResolvedValue({ data: { text: '184/198' } });

    const result = await extractText(MOCK_BUFFER);

    expect(result.numero).toBe('184');
    expect(result.totalColeccion).toBe('198');
  });

  test('OCR devuelve texto basura → confidence: "low", no tira error', async () => {
    // cleanText eliminará todo; claveLookup quedará vacía → confidence: 'low'
    mockWorker.recognize.mockResolvedValue({ data: { text: '!@#$%^&*()' } });

    const result = await extractText(MOCK_BUFFER);

    expect(result.confidence).toBe('low');
    expect(result.claveLookup).toBe('');
  });

  test('fallo total de Tesseract → confidence: "low", no tira error', async () => {
    mockWorker.recognize.mockRejectedValue(new Error('tesseract crashed'));

    const result = await extractText(MOCK_BUFFER);

    expect(result.confidence).toBe('low');
    expect(result.nombre).toBe('');
  });

});
