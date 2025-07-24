import adaptiveConfig from './adaptiveConfig.json';
import { Regime } from './regime';

export function getBudgetAndLeverage(regime: Regime): {
  budget: number;
  leverage: number;
} {
  // Pull from the new JSON properties
  const budget    = adaptiveConfig.budgetByRegime?.[regime]       ?? 10;
  const leverage  = adaptiveConfig.maxLeverageByRegime?.[regime] ?? 50;

  return { budget, leverage };
}
