const { normalizeAsset, normalizeType } = require('../../src/utils/aliasMapper');

describe('Alias Mapper Utility', () => {
  describe('normalizeAsset', () => {
    it('should convert known aliases to their standard ticker', () => {
      expect(normalizeAsset('bitcoin')).toBe('BTC');
      expect(normalizeAsset(' BITCOIN ')).toBe('BTC');
      expect(normalizeAsset('ethereum')).toBe('ETH');
      expect(normalizeAsset('tether')).toBe('USDT');
    });

    it('should uppercase and trim unknown assets', () => {
      expect(normalizeAsset(' doge ')).toBe('DOGE');
      expect(normalizeAsset('xrp')).toBe('XRP');
    });

    it('should return null for empty values', () => {
      expect(normalizeAsset(null)).toBeNull();
      expect(normalizeAsset('')).toBeNull();
    });
  });

  describe('normalizeType', () => {
    it('should normalize deposits to TRANSFER_IN', () => {
      expect(normalizeType('deposit')).toBe('TRANSFER_IN');
      expect(normalizeType('in')).toBe('TRANSFER_IN');
      expect(normalizeType('TRANSFER_IN')).toBe('TRANSFER_IN');
    });

    it('should normalize withdrawals to TRANSFER_OUT', () => {
      expect(normalizeType('withdrawal')).toBe('TRANSFER_OUT');
      expect(normalizeType('out')).toBe('TRANSFER_OUT');
      expect(normalizeType('TRANSFER_OUT')).toBe('TRANSFER_OUT');
    });

    it('should uppercase trades and buys', () => {
      expect(normalizeType('buy')).toBe('BUY');
      expect(normalizeType('swap')).toBe('TRADE');
      expect(normalizeType('trade')).toBe('TRADE');
    });

    it('should fallback to UNKNOWN or raw uppercase for unmapped types', () => {
      expect(normalizeType(null)).toBe('UNKNOWN');
      expect(normalizeType('')).toBe('UNKNOWN');
      expect(normalizeType('random')).toBe('RANDOM');
    });
  });
});
