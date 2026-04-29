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
