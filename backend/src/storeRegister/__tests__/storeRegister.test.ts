jest.mock('../../shared/db/orm.js', () => ({ orm: { em: { fork: jest.fn() } } }));
jest.mock('../storeInvite.entity.js', () => ({}));
jest.mock('../../user/user.entity.js', () => ({}));
jest.mock('../../vendedor/vendedores.entity.js', () => ({}));
jest.mock('bcryptjs', () => ({}));
jest.mock('jsonwebtoken', () => ({}));

import { isValidPhone, isHardcodedCode } from '../storeRegister.controller.js';

describe('isValidPhone', () => {
  it('accepts +54 9 XXXX XXXX format', () => {
    expect(isValidPhone('+54 9 1234 5678')).toBe(true);
  });

  it('rejects missing country code', () => {
    expect(isValidPhone('1234 5678')).toBe(false);
  });

  it('rejects wrong digit count', () => {
    expect(isValidPhone('+54 9 123 456')).toBe(false);
  });

  it('rejects letters', () => {
    expect(isValidPhone('+54 9 abcd efgh')).toBe(false);
  });
});

describe('isHardcodedCode', () => {
  it('accepts 123456', () => {
    expect(isHardcodedCode('123456')).toBe(true);
  });

  it('rejects any other value', () => {
    expect(isHardcodedCode('654321')).toBe(false);
    expect(isHardcodedCode('')).toBe(false);
    expect(isHardcodedCode('000000')).toBe(false);
  });
});

import { isValidHorario } from '../storeRegister.controller.js';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const horarioValido = Object.fromEntries(
  DIAS.map(d => [d, { abre: '09:00', cierra: '18:00', cerrado: false }])
);

describe('isValidHorario', () => {
  it('acepta horario con los 7 días completos', () => {
    expect(isValidHorario(horarioValido)).toBe(true);
  });

  it('acepta día cerrado', () => {
    const h = { ...horarioValido, domingo: { abre: '00:00', cierra: '00:00', cerrado: true } };
    expect(isValidHorario(h)).toBe(true);
  });

  it('rechaza null', () => {
    expect(isValidHorario(null)).toBe(false);
  });

  it('rechaza objeto sin todos los días', () => {
    const { domingo: _d, ...sinDomingo } = horarioValido as any;
    expect(isValidHorario(sinDomingo)).toBe(false);
  });

  it('rechaza día con campo faltante', () => {
    const h = { ...horarioValido, lunes: { abre: '09:00', cierra: '18:00' } };
    expect(isValidHorario(h)).toBe(false);
  });

  it('rechaza día con cerrado no booleano', () => {
    const h = { ...horarioValido, lunes: { abre: '09:00', cierra: '18:00', cerrado: 'no' } };
    expect(isValidHorario(h)).toBe(false);
  });
});
