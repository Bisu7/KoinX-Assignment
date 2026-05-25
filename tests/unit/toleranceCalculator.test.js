const { isTimestampWithinTolerance, isQuantityWithinTolerance } = require('../../src/utils/matching/toleranceCalculator');

describe('Tolerance Calculator', () => {
  describe('isTimestampWithinTolerance', () => {
    it('should return true if timestamps are identical', () => {
      const t1 = new Date('2023-01-01T12:00:00Z');
      const t2 = new Date('2023-01-01T12:00:00Z');
      expect(isTimestampWithinTolerance(t1, t2, 300)).toBe(true);
    });

    it('should return true if difference is within tolerance', () => {
      const t1 = new Date('2023-01-01T12:00:00Z');
      const t2 = new Date('2023-01-01T12:04:00Z'); // 240 seconds diff
      expect(isTimestampWithinTolerance(t1, t2, 300)).toBe(true);
    });

    it('should return false if difference exceeds tolerance', () => {
      const t1 = new Date('2023-01-01T12:00:00Z');
      const t2 = new Date('2023-01-01T12:06:00Z'); // 360 seconds diff
      expect(isTimestampWithinTolerance(t1, t2, 300)).toBe(false);
    });

    it('should handle null values safely', () => {
      expect(isTimestampWithinTolerance(null, new Date(), 300)).toBe(false);
      expect(isTimestampWithinTolerance(new Date(), null, 300)).toBe(false);
    });
  });

  describe('isQuantityWithinTolerance', () => {
    it('should return true for identical quantities', () => {
      expect(isQuantityWithinTolerance('1.5', '1.5', 0.01)).toBe(true);
    });

    it('should return true if quantities differ by less than tolerance percentage', () => {
      // 1% tolerance on 100 is +/- 1
      expect(isQuantityWithinTolerance('100', '100.5', 0.01)).toBe(true);
      expect(isQuantityWithinTolerance('100', '99.5', 0.01)).toBe(true);
    });

    it('should return false if difference exceeds tolerance percentage', () => {
      expect(isQuantityWithinTolerance('100', '102', 0.01)).toBe(false);
      expect(isQuantityWithinTolerance('100', '98', 0.01)).toBe(false);
    });

    it('should handle zero quantities safely to prevent division by zero', () => {
      expect(isQuantityWithinTolerance('0', '0.1', 0.01)).toBe(false);
      expect(isQuantityWithinTolerance('0', '0', 0.01)).toBe(true);
    });
  });
});
