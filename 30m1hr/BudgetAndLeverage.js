"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBudgetAndLeverage = void 0;
const adaptiveConfig_json_1 = __importDefault(require("./adaptiveConfig.json"));
function getBudgetAndLeverage(regime) {
    // Pull from the new JSON properties
    const budget = adaptiveConfig_json_1.default.budgetByRegime?.[regime] ?? 10;
    const leverage = adaptiveConfig_json_1.default.maxLeverageByRegime?.[regime] ?? 50;
    return { budget, leverage };
}
exports.getBudgetAndLeverage = getBudgetAndLeverage;
