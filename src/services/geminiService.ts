/**
 * Gemini AI Service for Enhanced Journal Analysis
 * Uses Google Gemini API for semantic understanding of journal entries
 */

import { DetectedTag, StrengthTag, WeaknessTag, SetupAnalysis } from '../types/journal';

const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface GeminiTagDetection {
  tag: string;
  severity: 'low' | 'med' | 'high';
  confidence: number;
  context?: string;
  reasoning?: string;
}

interface GeminiAnalysisResponse {
  behaviors: GeminiTagDetection[];
  setupAnalysis?: {
    entryMethod?: string;
    confirmationSignals?: string[];
    levelTypes?: string[];
    riskManagement?: string;
    exitStrategy?: string;
    improvements?: string[];
  };
}

/**
 * Analyze a journal entry using Gemini AI for semantic understanding
 */
export async function analyzeJournalEntryWithGemini(
  entryContent: string
): Promise<{ tags: DetectedTag[]; setupAnalysis?: SetupAnalysis }> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found. Falling back to keyword matching.');
    return [];
  }

  try {
    const prompt = createAnalysisPrompt(entryContent);
    const response = await fetch(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from Gemini API');
    }

    return parseGeminiResponse(text);
  } catch (error) {
    console.error('Gemini analysis error:', error);
    return { tags: [], setupAnalysis: undefined }; // Return empty to fall back to keyword matching
  }
}

/**
 * Create a structured prompt for Gemini analysis
 */
function createAnalysisPrompt(entryContent: string): string {
  return `You are analyzing a trading journal entry to detect behavioral patterns AND analyze setup details. Analyze the following journal entry comprehensively.

Journal Entry:
${entryContent}

TASK 1: Detect Behavioral Patterns

Available Strength Tags:
- patience_confirmation: Waiting for confirmation, patience in entries, not chasing
- level_thesis: Trading based on key levels, demand/supply zones, chart analysis
- hard_stop_respected: Taking stop losses, cutting losses quickly, no hope/hold
- base_hit_scalping: Taking small wins, scalping mindset, taking what market gives
- reset_composure: Stepping away, regaining discipline, mental reset
- reflection_learning: Learning from mistakes, backtesting, self-reflection
- mnq_scaling: Using MNQ for flexible sizing, scaling positions

Available Weakness Tags:
- premature_breakeven: Moving stop to breakeven too early, stopped out at BE before structure breaks
- tight_trailing: Trailing stops too tight, poor trailing management, left money on table
- chasing_early_entry: Chasing entries, rushing entries, entering before confirmation
- bias_lock: Stuck in bias, not trading price action, continuing in wrong direction
- sizing_drift: Over-risking, revenge sizing, too big in volatility
- data_candle_violation: Trading news/data candles, first 5-minute candle
- hesitation_missed_entry: Missing opportunities, hesitation, not executing on setups
- overtrading: Multiple re-entries, over-trading, taking too many trades
- process_error: Trade copier issues, ATM mistakes, technical errors

TASK 2: Analyze Setup Details

Extract and analyze the setup details mentioned in the entry:
- Entry method (e.g., "Retest of key level", "Breakdown", "Breakout", "Bull flag")
- Confirmation signals used (e.g., "Candle closure", "Rejection", "Volume confirmation")
- Level types identified (e.g., "Demand zone", "Supply zone", "Key level", "ORH/ORL")
- Risk management approach
- Exit strategy
- Specific improvements or adjustments needed

Return a JSON object with both behavioral tags AND setup analysis:
{
  "behaviors": [
    {
      "tag": "tag_name",
      "severity": "low|med|high",
      "confidence": 0.0-1.0,
      "context": "brief explanation",
      "reasoning": "why this tag applies"
    }
  ],
  "setupAnalysis": {
    "entryMethod": "description of entry method used",
    "confirmationSignals": ["signal1", "signal2"],
    "levelTypes": ["level type 1", "level type 2"],
    "riskManagement": "description of risk management approach",
    "exitStrategy": "description of exit strategy",
    "improvements": ["improvement 1", "improvement 2"]
  }
}

Only include tags that are clearly present. Be conservative with confidence scores. For setup analysis, extract specific details mentioned in the entry. Return ONLY valid JSON, no markdown, no explanation.`;
}

/**
 * Parse Gemini's JSON response into DetectedTag format and SetupAnalysis
 */
function parseGeminiResponse(responseText: string): { tags: DetectedTag[]; setupAnalysis?: SetupAnalysis } {
  try {
    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }
    
    // Try to find JSON object or array in the text
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    
    if (objectMatch) {
      jsonText = objectMatch[0];
    } else if (arrayMatch) {
      jsonText = arrayMatch[0];
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Handle both old format (array) and new format (object with behaviors and setupAnalysis)
    let behaviors: GeminiTagDetection[] = [];
    let setupAnalysis: SetupAnalysis | undefined = undefined;
    
    if (Array.isArray(parsed)) {
      // Old format - just behaviors array
      behaviors = parsed;
    } else if (parsed.behaviors && Array.isArray(parsed.behaviors)) {
      // New format - object with behaviors and setupAnalysis
      behaviors = parsed.behaviors;
      if (parsed.setupAnalysis) {
        setupAnalysis = {
          entryMethod: parsed.setupAnalysis.entryMethod,
          confirmationSignals: parsed.setupAnalysis.confirmationSignals,
          levelTypes: parsed.setupAnalysis.levelTypes,
          riskManagement: parsed.setupAnalysis.riskManagement,
          exitStrategy: parsed.setupAnalysis.exitStrategy,
          improvements: parsed.setupAnalysis.improvements
        };
      }
    } else {
      return { tags: [], setupAnalysis: undefined };
    }

    const tags = behaviors
      .filter((item: GeminiTagDetection) => {
        // Validate tag exists
        const validTags: string[] = [
          'patience_confirmation', 'level_thesis', 'hard_stop_respected',
          'base_hit_scalping', 'reset_composure', 'reflection_learning', 'mnq_scaling',
          'premature_breakeven', 'tight_trailing', 'chasing_early_entry',
          'bias_lock', 'sizing_drift', 'data_candle_violation',
          'hesitation_missed_entry', 'overtrading', 'process_error'
        ];
        return validTags.includes(item.tag);
      })
      .map((item: GeminiTagDetection) => ({
        tag: item.tag as StrengthTag | WeaknessTag,
        severity: item.severity,
        confidence: Math.min(1.0, Math.max(0.0, item.confidence || 0.5)),
        context: item.context,
        matchedPhrases: item.reasoning ? [item.reasoning] : []
      }));
    
    return { tags, setupAnalysis };
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return { tags: [], setupAnalysis: undefined };
  }
}

/**
 * Batch analyze multiple journal entries with rate limiting
 */
export async function analyzeJournalEntriesWithGemini(
  entries: { content: string }[],
  batchSize: number = 5,
  delayMs: number = 1000
): Promise<{ tags: DetectedTag[]; setupAnalysis?: SetupAnalysis }[]> {
  const results: { tags: DetectedTag[]; setupAnalysis?: SetupAnalysis }[] = [];
  
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(entry => analyzeJournalEntryWithGemini(entry.content))
    );
    results.push(...batchResults);
    
    // Rate limiting - wait between batches
    if (i + batchSize < entries.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

