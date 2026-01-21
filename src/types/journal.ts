/**
 * Behavioral Analysis System - Data Models
 * 
 * This system extracts behavioral patterns from trading journal entries,
 * calculates process scores, and generates actionable daily plans.
 */

export interface QuantMetrics {
  positionSize?: string; // e.g., "1 NQ", "3 MNQ"
  riskPoints?: number; // Risk in points
  exitPoints?: number; // Exit in points
  riskRewardRatio?: number; // R:R ratio
  winLoss?: 'win' | 'loss' | 'breakeven' | 'unknown';
  entryType?: string; // e.g., "Retest of key level", "Breakdown"
  timeframe?: string; // e.g., "1min-5min", "15min-1hr"
  setupType?: string; // e.g., "Bull flag", "Bear flag", "Retest"
  marketCondition?: string; // e.g., "Choppy", "Trending", "Volatile"
}

export interface SetupAnalysis {
  entryMethod?: string;
  confirmationSignals?: string[];
  levelTypes?: string[];
  riskManagement?: string;
  exitStrategy?: string;
  improvements?: string[];
}

export interface JournalEntry {
  id: string;
  date: string; // ISO date string
  content: string; // Full journal entry text
  tradeIds?: string[]; // Associated trade IDs
  detectedTags?: DetectedTag[];
  processScore?: number; // 0-100
  quantMetrics?: QuantMetrics;
  setupAnalysis?: SetupAnalysis;
  createdAt?: string;
}

export interface DetectedTag {
  tag: StrengthTag | WeaknessTag;
  severity: 'low' | 'med' | 'high';
  confidence: number; // 0-1, based on keyword matches
  context?: string; // Extracted context from entry
  matchedPhrases: string[]; // Which phrases triggered this tag
}

export type StrengthTag =
  | 'patience_confirmation'
  | 'level_thesis'
  | 'hard_stop_respected'
  | 'base_hit_scalping'
  | 'reset_composure'
  | 'reflection_learning'
  | 'mnq_scaling';

export type WeaknessTag =
  | 'premature_breakeven'
  | 'tight_trailing'
  | 'chasing_early_entry'
  | 'bias_lock'
  | 'sizing_drift'
  | 'data_candle_violation'
  | 'hesitation_missed_entry'
  | 'overtrading'
  | 'process_error';

export interface DaySummary {
  date: string;
  entries: JournalEntry[];
  totalTags: {
    strengths: DetectedTag[];
    weaknesses: DetectedTag[];
  };
  processScore: number;
  strengthCount: number;
  weaknessCount: number;
}

export interface WeekSummary {
  startDate: string;
  endDate: string;
  days: DaySummary[];
  strengthPercentage: number; // For pie chart
  weaknessPercentage: number; // For pie chart
  strengthBreakdown: Record<StrengthTag, number>; // Count per strength tag
  weaknessBreakdown: Record<WeaknessTag, number>; // Count per weakness tag
  weightedStrengthScore: number; // Weighted by severity
  weightedWeaknessScore: number; // Weighted by severity
}

export interface DailyPlan {
  date: string;
  riskCap: string; // e.g., "$250-$500"
  maxStop: string; // e.g., "15 points"
  sizingLadder: string; // e.g., "1 NQ, scale to 3 MNQ"
  twoStrikeRule: boolean; // Walk away after 2 bad trades
  noFirst5Min: boolean; // Don't trade first 5 min
  noDataCandle: boolean; // Don't trade data candle
  retestOnly: boolean; // Only enter on retests
  beAfterStructure: boolean; // BE only after structure breaks
  chopFilter: boolean; // Sit out choppy conditions
  biasFlipProtocol: boolean; // Flip bias after X losses
  customReminders: string[]; // Based on frequent weaknesses
}
