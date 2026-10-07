import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/utils/**/*.ts',
        'src/services/matchingService.ts',
        'src/costs/services/CostCalculationService.ts',
        'src/fiscal/services/FiscalPayloadMapper.ts',
        'src/middleware/auth.ts',
        'src/middleware/requireRole.ts',
        'src/printing/services/ReceiptPayloadBuilder.ts',
        'src/printing/services/PrintJobService.ts',
        'src/printing/services/DeviceTokenService.ts',
        'src/caja/services/CashShiftService.ts',
        'src/caja/services/CashShiftMigrationService.ts',
        'src/printing/services/ReceiptEmailContext.ts'
      ],
      exclude: ['src/**/*.test.ts']
    }
  }
});
