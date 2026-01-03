export interface Account {
  id: string;
  name: string; // e.g., "TopStep - Nov 2024"
  propFirm: string; // e.g., "TopStep", "Apex", "FTMO"
  accountSize: number; // e.g., 50000, 150000
  startDate: string;
  status: 'active' | 'passed' | 'failed' | 'archived';
  notes?: string;
}

export interface Trade {
  id: string;
  accountId?: string; // Link to prop firm account
  date: string;
  symbol: string;
  assetType: 'stock' | 'futures' | 'options' | 'crypto' | 'forex';
  contractType?: 'mini' | 'micro'; // For futures only
  type: 'buy' | 'sell';
  position: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  exitDate?: string; // When the trade was closed
  entryTime?: string; // Precise entry time (HH:MM format)
  exitTime?: string; // Precise exit time (HH:MM format)
  stopLoss?: number;
  targetPrice?: number;
  riskRewardRatio?: number;
  duration?: string; // How long the trade was held (e.g., "2h 15m", "3 days")
  notes?: string;
  status: 'open' | 'closed';
  pnl?: number;
  tags?: string[];
  photos?: string[]; // Base64 encoded images
  strategy?: string; // Trading strategy/system name
  riskAmount?: number; // Actual $ risked on the trade
  rMultiple?: number; // How many R's the trade made (PnL / Risk)
  marketCondition?: 'trending' | 'choppy' | 'volatile' | 'low_volatility' | 'ranging';
  session?: 'pre_market' | 'regular' | 'after_hours' | 'futures_globex';
  setupType?: string; // Chart pattern/setup (e.g., "Bull Flag", "Demand Zone Retest")
  entryReason?: string; // Why you entered
  exitReason?: string; // Why you exited
}

export interface TradeFormData {
  date: string;
  symbol: string;
  assetType: 'stock' | 'futures' | 'options' | 'crypto' | 'forex';
  contractType?: 'mini' | 'micro'; // For futures only
  type: 'buy' | 'sell';
  position: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  entryTime?: string;
  exitTime?: string;
  stopLoss?: number;
  targetPrice?: number;
  notes?: string;
  tags?: string;
  strategy?: string;
  riskAmount?: number;
  marketCondition?: 'trending' | 'choppy' | 'volatile' | 'low_volatility' | 'ranging';
  session?: 'pre_market' | 'regular' | 'after_hours' | 'futures_globex';
  setupType?: string;
  entryReason?: string;
  exitReason?: string;
}