/**
 * Market Intelligence Assistant (MIA) Service
 * Uses Gemini AI to provide factual market data without trading advice
 */

const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const MIA_SYSTEM_PROMPT = `You are a Market Intelligence Assistant (MIA) for a quant trader.

Rules:
- You provide factual, up-to-date market information only.
- You do NOT give trade ideas, bias, probabilities, or opinions.
- You do NOT interpret price action.
- You respond concisely and objectively.

You can:
- Pull economic calendar data
- Report earnings dates and times
- Return sentiment indicators (CNN Fear & Greed, VIX level)
- Provide session stats (range, highs/lows)
- Answer "what / when / how much" questions

If a question asks for advice or interpretation, respond:
"I can provide the data, but not trading recommendations."

Acknowledge and follow these rules strictly.`;

export interface MIAMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Send a message to MIA and get a response
 */
export async function sendMIAMessage(
  message: string,
  conversationHistory: MIAMessage[] = []
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return '⚠️ Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.';
  }

  try {
    // Build conversation context
    const conversationContext = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const fullPrompt = `${MIA_SYSTEM_PROMPT}\n\n${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ''}User: ${message}\nAssistant:`;

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
                  text: fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3, // Lower temperature for more factual responses
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from Gemini API');
    }

    return text.trim();
  } catch (error) {
    console.error('MIA service error:', error);
    return `❌ Error: ${error instanceof Error ? error.message : 'Failed to get response from MIA'}`;
  }
}

/**
 * Check if MIA is available (API key configured)
 */
export function isMIAAvailable(): boolean {
  return !!GEMINI_API_KEY;
}

