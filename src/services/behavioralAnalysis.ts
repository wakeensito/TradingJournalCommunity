/**
 * Behavioral Analysis Service
 * Detects trading behaviors from journal entries and calculates process scores
 * Uses Gemini AI when available for enhanced semantic analysis, falls back to keyword matching
 */

import { JournalEntry, DetectedTag, StrengthTag, WeaknessTag, DaySummary, WeekSummary, DailyPlan } from '../types/journal';
import { analyzeJournalEntryWithGemini } from './geminiService';

// Keyword/phrase triggers for each tag, calibrated from user entries
const TAG_TRIGGERS: { [key in StrengthTag | WeaknessTag]: { keywords: string[]; confidence: number }[] } = {
  patience_confirmation: [
    { keywords: ['waited for close', 'waited patiently', 'retest happen', 'didn\'t chase', 'patience paid', 'stayed patient', 'waiting for a sense of direction', 'let it play out', 'let the trade breathe', 'waited for 100% confirmation', 'stayed patient let a break and retest happen', 'stayed patient', 'patience is the ultimate confidence', 'great patience'], confidence: 0.9 },
    { keywords: ['aggressively rejected', 'confirming my conviction', 'confirmation of weakness', 'confirmation under key level', 'close below', 'close above', 'candle closure', 'candle closure above', 'candle closure below'], confidence: 0.8 },
    { keywords: ['didn\'t jump in too early', 'not jump in too early', 'waited'], confidence: 0.7 },
  ],
  level_thesis: [
    { keywords: ['key demand zone', 'key levels', 'demand/supply', 'ORH', 'ORL', 'HTF context', 'fair value gap', 'macro key level', 'micro key level', 'charted demand', 'charted levels', 'key level', 'retest of key level'], confidence: 0.9 },
    { keywords: ['retest of key level', 'reclaimed a key level', 'breakdown of key levels', 'break-retest of key level', 'bull flag', 'bear flag'], confidence: 0.8 },
    { keywords: ['reading the chart', 'trust your levels'], confidence: 0.7 },
  ],
  hard_stop_respected: [
    { keywords: ['took SL', 'no hope/hold', 'let my S/L hit', 'hard stops', 'let my S/L hit', 'took my losses'], confidence: 1.0 },
    { keywords: ['cut losses quickly', 'power of cutting losses quickly'], confidence: 0.9 },
  ],
  base_hit_scalping: [
    { keywords: ['took 1-2R', 'base hit', 'scalpers mindset', 'took the scalp', 'nice base hit', 'small wins', 'scalping edge', 'consistently scalping', 'took what the market gave', 'scalp'], confidence: 0.9 },
    { keywords: ['took what the market gave', 'took the profits that was given', 'take the base hit'], confidence: 0.8 },
  ],
  reset_composure: [
    { keywords: ['stepped away', 'regained discipline', 'reset', 'clear mind', 'shutting the charts off', 'clear my head', 'walk away', 'not letting 1 bad trade take me out of the game', 'lock in make sure the smoke in my mind clears up'], confidence: 1.0 },
    { keywords: ['stayed composed', 'mindset was solid', 'staying sharp', 'staying grounded', 'not over-focusing'], confidence: 0.8 },
  ],
  reflection_learning: [
    { keywords: ['wrote clear lessons', 'lessons learned', 'mistake to correct', 'huge lesson learned', 'learn from the most', 'backtest your entries', 'backtest all these breakeven trades'], confidence: 1.0 },
    { keywords: ['room for improvement', 'need to refine', 'need to improve'], confidence: 0.7 },
  ],
  mnq_scaling: [
    { keywords: ['scaled with MNQ', 'added with MNQ', 'flexible sizing', 'mnq flexibility', 'sized lightly and added', 'mnq flexibility of getting an early entry'], confidence: 1.0 },
    { keywords: ['mnq is a lot of money', 'trading mnq moving forward'], confidence: 0.8 },
  ],
  premature_breakeven: [
    { keywords: ['moved stop to breakeven too early', 'breakeven way too many times', 'stopped out at breakeven before structure broke', 'premature breakeven', 'breakeven first trade', 'breakeven second trade', 'anything 25 points should not reverse breakeven', 'breakeven way to many times', 'breakeven trades a lot', 'breakeven damn near 1000000 times', 'breakeven ok but stopped out twice', 'got breakeven', 'breakeven 2/2'], confidence: 1.0 },
    { keywords: ['trading my P&L, not the chart', 'moved my trailing stop too early', 'left 100points on the table', 'moved my 50 point tp', 'moved my trailing stop just to breakeven'], confidence: 0.9 },
    { keywords: ['bullish price action rewards structure, not just point-based risk models', 'moved stop to breakeven as soon as i was up 1R'], confidence: 0.8 },
  ],
  tight_trailing: [
    { keywords: ['trailed too tight', 'moved trail early', 'poor trailing management', 'didn\'t get to TP', '3 points away from TP', 'watched it completely reversed', 'sold slightly early', 'sold $2 early', 'sold early before my target hit'], confidence: 1.0 },
    { keywords: ['left a lot on the table by not trailing longs effectively', 'poor trade management'], confidence: 0.9 },
  ],
  chasing_early_entry: [
    { keywords: ['chasing lows', 'chased a few setups', 'chase entry instant stop', 'stop chasing', 'every time you chase you pay', 'literal chase of the bottom', 'rushed entry', 'rushed a few of my entries', 'early on my entry', 'early entry should be half size', 'chase entry instant stop', 'chasing never pays'], confidence: 1.0 },
    { keywords: ['entered late', 'before retest/close', 'jumped in front of', 'rushed', 'early'], confidence: 0.9 },
    { keywords: ['not at my level, it\'s not my trade', 'if it\'s not at my level'], confidence: 0.8 },
  ],
  bias_lock: [
    { keywords: ['stayed bearish despite PA changing', 'stayed bullish despite PA changing', 'kept shorting', 'continued shorting & shorting & shorting & shorting', 'stayed in my bias rather than trading what I was seeing', 'stuck to my bias'], confidence: 1.0 },
    { keywords: ['neutralize my bias and trade price action'], confidence: 0.9 },
    { keywords: ['didn\'t flip long stuck to my bias'], confidence: 0.7 },
  ],
  sizing_drift: [
    { keywords: ['too big in volatility', 'revenge size', 'eval/payout pressure', 'blew an account', 'blow up 2 accounts', 'losing $1500', 'no consistency rule got to me', 'didn\'t think of how much i was losing instead thought of how much i can make', 'lack of risk management', 'larger moves & volatility calls for smaller size', 'never risk more than 15 points on a single NQ', 'never risk more than 25 on a trade', 'risk 25 points with full size'], confidence: 1.0 },
    { keywords: ['too big', 'too much size', 'over-risking', 'max size (1nq)'], confidence: 0.9 },
    { keywords: ['could\'ve cut size in half', 'sizing down'], confidence: 0.8 },
  ],
  data_candle_violation: [
    { keywords: ['traded news candle', 'first 5-min', 'data candle', 'do not trade the first 5-minute candle', 'first 15 min low', 'trading the first 5-minute candle'], confidence: 1.0 },
    { keywords: ['unnecessary drawdown', 'rookie mistake'], confidence: 0.9 },
  ],
  hesitation_missed_entry: [
    { keywords: ['A+ setup called out but no execution', 'didn\'t execute', 'missed opportunity', 'no execution', 'wasn\'t to confident in price action', 'missed long entry', 'missed opportunities of about 2 other trades', 'no more hesitation', 'hesitation and no execution', 'lots of hesitation', 'lots of missed opportunities', 'missed my re-entries', 'missed opportunities', 'to many to count', 'tons of missed opportunities', 'no entries', 'didn\'t execute on monday'], confidence: 1.0 },
    { keywords: ['didn\'t take it at first', 'watched the whole trade i\'ve wanted play-out', 'didn\'t execute on', 'missed', 'hesitation'], confidence: 0.9 },
  ],
  overtrading: [
    { keywords: ['multiple re-entries', 'multi-fire after loss', 'entered and exited multiple times', 'don\'t multi fire trades', 'over trading', 'stopped out multiple times re-entering shorts in chop', 'don\'t take the same trade and got stopped out on the same candle'], confidence: 1.0 },
    { keywords: ['too many L\'s'], confidence: 0.9 },
  ],
  process_error: [
    { keywords: ['trade copier issues', 'trade copier/ATM mistakes', 'atm tool was acting up', 'managed all 3 accounts individually', 'pay attention to trade copier', 'made a huge mistake on trade copier'], confidence: 1.0 },
    { keywords: ['process error'], confidence: 0.9 },
  ],
};

const WEAKNESS_SEVERITY: { [key in WeaknessTag]: 'low' | 'med' | 'high' } = {
  premature_breakeven: 'high',
  tight_trailing: 'high',
  chasing_early_entry: 'high',
  bias_lock: 'high',
  sizing_drift: 'high',
  data_candle_violation: 'med',
  hesitation_missed_entry: 'med',
  overtrading: 'med',
  process_error: 'low',
};

const STRENGTH_SEVERITY: { [key in StrengthTag]: 'low' | 'med' | 'high' } = {
  patience_confirmation: 'high',
  level_thesis: 'high',
  hard_stop_respected: 'high',
  base_hit_scalping: 'med',
  reset_composure: 'med',
  reflection_learning: 'med',
  mnq_scaling: 'low',
};

/**
 * Detect behavioral tags from journal entry text
 * Uses Gemini AI when available, falls back to keyword matching
 */
export async function detectTags(entry: JournalEntry, useGemini: boolean = false): Promise<DetectedTag[]> {
  // Try Gemini first if enabled and API key is available
  if (useGemini && import.meta.env.VITE_GEMINI_API_KEY) {
    try {
      const geminiTags = await analyzeJournalEntryWithGemini(entry.content);
      if (geminiTags.length > 0) {
        // Merge with keyword matching for better coverage
        const keywordTags = detectTagsKeyword(entry);
        return mergeTags(geminiTags, keywordTags);
      }
    } catch (error) {
      console.warn('Gemini analysis failed, falling back to keyword matching:', error);
    }
  }
  
  // Fallback to keyword matching
  return detectTagsKeyword(entry);
}

/**
 * Keyword-based tag detection (fallback method)
 */
function detectTagsKeyword(entry: JournalEntry): DetectedTag[] {
  const tags: DetectedTag[] = [];
  const content = entry.content.toLowerCase();
  
  // Check each tag type
  for (const [tag, triggers] of Object.entries(TAG_TRIGGERS)) {
    let maxConfidence = 0;
    const matchedPhrases: string[] = [];
    
    for (const trigger of triggers) {
      for (const keyword of trigger.keywords) {
        if (content.includes(keyword.toLowerCase())) {
          maxConfidence = Math.max(maxConfidence, trigger.confidence);
          matchedPhrases.push(keyword);
        }
      }
    }
    
    if (maxConfidence > 0.5) {
      const severity = (tag in WEAKNESS_SEVERITY 
        ? WEAKNESS_SEVERITY[tag as WeaknessTag]
        : STRENGTH_SEVERITY[tag as StrengthTag]);
      
      tags.push({
        tag: tag as StrengthTag | WeaknessTag,
        severity,
        confidence: maxConfidence,
        matchedPhrases: [...new Set(matchedPhrases)]
      });
    }
  }
  
  return tags;
}

/**
 * Merge Gemini tags with keyword tags, preferring Gemini when available
 */
function mergeTags(geminiTags: DetectedTag[], keywordTags: DetectedTag[]): DetectedTag[] {
  const merged: DetectedTag[] = [...geminiTags];
  const geminiTagNames = new Set(geminiTags.map(t => t.tag));
  
  // Add keyword tags that weren't detected by Gemini
  for (const keywordTag of keywordTags) {
    if (!geminiTagNames.has(keywordTag.tag)) {
      merged.push(keywordTag);
    }
  }
  
  return merged;
}

/**
 * Calculate process score (0-100) based on detected tags
 */
export function calculateProcessScore(tags: DetectedTag[]): number {
  let score = 50; // Start at neutral
  
  const strengths = tags.filter(t => !(t.tag in WEAKNESS_SEVERITY));
  const weaknesses = tags.filter(t => t.tag in WEAKNESS_SEVERITY);
  
  // Add points for strengths
  for (const tag of strengths) {
    const points = tag.severity === 'high' ? 5 : tag.severity === 'med' ? 3 : 2;
    score += points * tag.confidence;
  }
  
  // Subtract points for weaknesses
  for (const tag of weaknesses) {
    const points = tag.severity === 'high' ? -8 : tag.severity === 'med' ? -5 : -3;
    score += points * tag.confidence;
  }
  
  // Cap between 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate pie chart percentages for strengths and weaknesses
 */
export function calculatePieChartData(entries: JournalEntry[]): {
  strengths: { tag: StrengthTag; percentage: number; count: number }[];
  weaknesses: { tag: WeaknessTag; percentage: number; count: number }[];
} {
  const strengthCounts: Record<StrengthTag, number> = {
    patience_confirmation: 0,
    level_thesis: 0,
    hard_stop_respected: 0,
    base_hit_scalping: 0,
    reset_composure: 0,
    reflection_learning: 0,
    mnq_scaling: 0,
  };
  
  const weaknessCounts: Record<WeaknessTag, number> = {
    premature_breakeven: 0,
    tight_trailing: 0,
    chasing_early_entry: 0,
    bias_lock: 0,
    sizing_drift: 0,
    data_candle_violation: 0,
    hesitation_missed_entry: 0,
    overtrading: 0,
    process_error: 0,
  };
  
  // Count occurrences with severity weighting
  for (const entry of entries) {
    if (!entry.detectedTags) continue;
    
    for (const tag of entry.detectedTags) {
      const weight = tag.severity === 'high' ? 3 : tag.severity === 'med' ? 2 : 1;
      
      if (tag.tag in strengthCounts) {
        strengthCounts[tag.tag as StrengthTag] += weight;
      } else if (tag.tag in weaknessCounts) {
        weaknessCounts[tag.tag as WeaknessTag] += weight;
      }
    }
  }
  
  // Calculate percentages
  const totalStrengthWeight = Object.values(strengthCounts).reduce((a, b) => a + b, 0);
  const totalWeaknessWeight = Object.values(weaknessCounts).reduce((a, b) => a + b, 0);
  
  const strengths = Object.entries(strengthCounts)
    .filter(([_, count]) => count > 0)
    .map(([tag, count]) => ({
      tag: tag as StrengthTag,
      percentage: totalStrengthWeight > 0 ? (count / totalStrengthWeight) * 100 : 0,
      count
    }))
    .sort((a, b) => b.percentage - a.percentage);
  
  const weaknesses = Object.entries(weaknessCounts)
    .filter(([_, count]) => count > 0)
    .map(([tag, count]) => ({
      tag: tag as WeaknessTag,
      percentage: totalWeaknessWeight > 0 ? (count / totalWeaknessWeight) * 100 : 0,
      count
    }))
    .sort((a, b) => b.percentage - a.percentage);
  
  return { strengths, weaknesses };
}

/**
 * Generate daily plan based on recent journal entries
 */
export function generateDailyPlan(entries: JournalEntry[], date: string): DailyPlan {
  const recentEntries = entries
    .filter(e => new Date(e.date) <= new Date(date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
  
  // Count weakness frequencies
  const weaknessFreq: Record<WeaknessTag, number> = {
    premature_breakeven: 0,
    tight_trailing: 0,
    chasing_early_entry: 0,
    bias_lock: 0,
    sizing_drift: 0,
    data_candle_violation: 0,
    hesitation_missed_entry: 0,
    overtrading: 0,
    process_error: 0,
  };
  
  for (const entry of recentEntries) {
    if (!entry.detectedTags) continue;
    for (const tag of entry.detectedTags) {
      if (tag.tag in weaknessFreq) {
        weaknessFreq[tag.tag as WeaknessTag]++;
      }
    }
  }
  
  // Generate reminders based on frequent weaknesses
  const reminders: string[] = [];
  
  if (weaknessFreq.premature_breakeven >= 3) {
    reminders.push('⚠️ BE only AFTER structure breaks, not at fixed points');
  }
  if (weaknessFreq.chasing_early_entry >= 2) {
    reminders.push('⏳ Wait for candle closure - no chasing entries');
  }
  if (weaknessFreq.data_candle_violation >= 1) {
    reminders.push('🚫 NO trading first 5-minute candle');
  }
  if (weaknessFreq.hesitation_missed_entry >= 3) {
    reminders.push('✅ Define risk & execute on A+ setups');
  }
  if (weaknessFreq.overtrading >= 2) {
    reminders.push('🛑 Walk away after 2 bad trades');
  }
  if (weaknessFreq.sizing_drift >= 1) {
    reminders.push('💰 Max 1 NQ, never risk >15 points');
  }
  if (weaknessFreq.bias_lock >= 2) {
    reminders.push('🔄 Trade price action, not bias');
  }
  
  return {
    date,
    riskCap: '$250-$500',
    maxStop: '15 points',
    sizingLadder: '1 NQ, scale to 3 MNQ',
    twoStrikeRule: weaknessFreq.overtrading >= 2,
    noFirst5Min: weaknessFreq.data_candle_violation >= 1,
    noDataCandle: weaknessFreq.data_candle_violation >= 1,
    retestOnly: weaknessFreq.chasing_early_entry >= 2,
    beAfterStructure: weaknessFreq.premature_breakeven >= 3,
    chopFilter: true,
    biasFlipProtocol: weaknessFreq.bias_lock >= 2,
    customReminders: reminders
  };
}

/**
 * Analyze journal entries and return summary
 * @param entries - Journal entries to analyze
 * @param useGemini - Whether to use Gemini AI for enhanced analysis (requires API key)
 */
export async function analyzeJournalEntries(
  entries: JournalEntry[],
  useGemini: boolean = false
): Promise<{
  entries: JournalEntry[];
  pieChartData: ReturnType<typeof calculatePieChartData>;
  averageProcessScore: number;
  weeklyPlan: DailyPlan;
}> {
  // Detect tags for all entries (async if using Gemini)
  const analyzedEntries = await Promise.all(
    entries.map(async (entry) => {
      const detectedTags = await detectTags(entry, useGemini);
      return {
        ...entry,
        detectedTags,
        processScore: calculateProcessScore(detectedTags)
      };
    })
  );
  
  const pieChartData = calculatePieChartData(analyzedEntries);
  const averageProcessScore = analyzedEntries.length > 0
    ? analyzedEntries.reduce((sum, e) => sum + (e.processScore || 0), 0) / analyzedEntries.length
    : 0;
  
  const latestDate = analyzedEntries.length > 0
    ? analyzedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
    : new Date().toISOString().split('T')[0];
  
  const weeklyPlan = generateDailyPlan(analyzedEntries, latestDate);
  
  return {
    entries: analyzedEntries,
    pieChartData,
    averageProcessScore,
    weeklyPlan
  };
}

