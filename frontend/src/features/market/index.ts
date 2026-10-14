// Market context module (additive). See docs/market-context.md for the API and integration notes.
export { MarketContextStrip } from './MarketContextStrip';
export type { MarketContextStripProps } from './MarketContextStrip';
export { TradeChart } from './TradeChart';
export type { ChartTrade, TradeChartProps } from './TradeChart';
export { useMarketDay, useMarketBars, fetchMarketDay, barsTooOld } from './useMarket';
export type { MarketState } from './useMarket';
export { eventsForPlan } from './market';
export type { ApiGet, MarketDay, MarketEvent, MarketBars, Bar } from './market';
