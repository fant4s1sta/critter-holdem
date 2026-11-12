export const CHIP_VALUES = [10, 20, 50, 100, 500] as const;
const CHIP_UNIT = 10;

export function isChipAmount(amount: number) {
  return Number.isSafeInteger(amount) && amount >= 0 && amount % CHIP_UNIT === 0;
}

/** Counts are ordered 10, 20, 50, 100, 500. Never accept fractional chips. */
export function chipTotal(counts: unknown): number {
  if (!Array.isArray(counts) || counts.length !== CHIP_VALUES.length ||
      counts.some(count => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('筹码数量必须是五种面值对应的非负整数');
  }
  const total = CHIP_VALUES.reduce((sum, value, i) => sum + value * counts[i], 0);
  if (!isChipAmount(total)) throw new Error('筹码金额无效');
  return total;
}
