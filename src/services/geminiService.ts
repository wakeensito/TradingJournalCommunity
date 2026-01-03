/**
 * Gemini AI Service for Enhanced Journal Analysis
 * Uses Google Gemini API for semantic understanding of journal entries
 */

import { DetectedTag, StrengthTag, WeaknessTag } from '../types/journal';

const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface GeminiTagDetection {
  tag: string;
  severity: 'low' | 'med' | 'high';
  confidence: number;
  context?: string;
  reasoning?: string;
}

/**
 * Analyze a journal entry using Gemini AI for semantic understanding
 */
export async function analyzeJournalEntryWithGemini(
  entryContent: string
): Promise<DetectedTag[]> {
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
    return []; // Return empty array to fall back to keyword matching
  }
}

/**
 * Create a structured prompt for Gemini analysis
 */
function createAnalysisPrompt(entryContent: string): string {
  return `You are analyzing a trading journal entry to detect behavioral patterns. Analyze the following journal entry and identify trading behaviors.

Journal Entry:
${entryContent}

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

Return a JSON array of detected behaviors in this format:
[
  {
    "tag": "tag_name",
    "severity": "low|med|high",
    "confidence": 0.0-1.0,
    "context": "brief explanation",
    "reasoning": "why this tag applies"
  }
]

Only include tags that are clearly present. Be conservative with confidence scores. Return ONLY valid JSON, no markdown, no explanation.`;
}

/**
 * Parse Gemini's JSON response into DetectedTag format
 */
function parseGeminiResponse(responseText: string): DetectedTag[] {
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
    
    // Try to find JSON array in the text
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonText);
    
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
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
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return [];
  }
}

/**
 * Batch analyze multiple journal entries with rate limiting
 */
export async function analyzeJournalEntriesWithGemini(
  entries: { content: string }[],
  batchSize: number = 5,
  delayMs: number = 1000
): Promise<DetectedTag[][]> {
  const results: DetectedTag[][] = [];
  
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

