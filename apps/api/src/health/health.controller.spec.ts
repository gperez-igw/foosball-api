import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  describe('healthCheck', () => {
    it('returns status ok', () => {
      const result = controller.healthCheck();
      expect(result.status).toBe('ok');
    });

    it('returns a valid ISO timestamp', () => {
      const result = controller.healthCheck();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('returns timestamp close to now', () => {
      const before = Date.now();
      const result = controller.healthCheck();
      const after = Date.now();
      const ts = new Date(result.timestamp).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });
});
