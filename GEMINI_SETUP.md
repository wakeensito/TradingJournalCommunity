# Gemini AI Setup Guide

## Enhanced Journal Analysis with Gemini

The journal analysis system can use Google's Gemini AI for more accurate, semantic understanding of your trading journal entries.

## Setup Instructions

1. **Get a Gemini API Key**
   - Visit: https://makersuite.google.com/app/apikey
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy your API key

2. **Add to Environment Variables**
   - Create a `.env` file in the project root (if it doesn't exist)
   - Add your API key:
     ```
     VITE_GEMINI_API_KEY=your_actual_api_key_here
     ```

3. **Restart Dev Server**
   - Stop your current dev server (Ctrl+C)
   - Run `npm run dev` again

## Usage

1. Go to the **Journal Analysis** tab
2. Paste your journal entries
3. Check the **"Use Gemini AI for enhanced analysis"** checkbox
4. Click **"Analyze Journal Entries"**

## Benefits

- **Better Semantic Understanding**: Gemini understands context and meaning, not just keywords
- **More Accurate Tag Detection**: Detects behaviors even when you use different wording
- **Contextual Analysis**: Understands the relationship between different parts of your journal entry
- **Hybrid Approach**: Combines Gemini AI with keyword matching for best results

## Fallback

If Gemini API key is not set, the system automatically falls back to keyword-based analysis, which still works well but is less sophisticated.

## Cost

Gemini API has a generous free tier. Check current pricing at: https://ai.google.dev/pricing

