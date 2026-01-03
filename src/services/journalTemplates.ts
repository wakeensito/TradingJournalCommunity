/**
 * Journal Entry Templates
 * Pre-formatted templates optimized for behavioral analysis
 */

export interface JournalTemplate {
  id: string;
  name: string;
  description: string;
  category: 'daily' | 'trade' | 'weekly' | 'quick';
  template: string;
}

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'daily-full',
    name: 'Daily Trading Journal (Full)',
    description: 'Comprehensive daily journal with all sections',
    category: 'daily',
    template: `Trading Journal - [DATE]

📊 Overall Conviction: [Bullish/Bearish/Neutral]
[Brief explanation of your market bias and why]

Setup Details:
📌 Entry: [Entry method - e.g., "Retest of key level", "Candle closure above ORH"]
📊 Position Size: [X] NQ/MNQ contracts
💎 Risk: [X] points
🎯 Exit: [Exit method - e.g., "Trailed stop", "Target hit", "Breakeven"]

Execution:
Morning Session: [Describe morning trades and execution quality]
Afternoon Session: [Describe afternoon trades if any]
Night Session: [Describe overnight trades if any]

Lessons Learned:
✅ [What went well - e.g., "Great patience waiting for retest", "Solid entry on key level"]
❌ [What needs improvement - e.g., "Moved stop to breakeven too early", "Chased entry instead of waiting"]

Trade Management:
[Describe how you managed trades - trailing stops, scaling, exits]

Missed Opportunities:
[Any setups you saw but didn't take, and why]

Final Thoughts:
[Overall reflection on the day, mindset, and key takeaways]`
  },
  {
    id: 'post-trade',
    name: 'Post-Trade Analysis',
    description: 'Quick analysis after closing a trade',
    category: 'trade',
    template: `Trade Analysis - [DATE] [TIME]

Setup: [Brief setup description]
Entry: [Entry price] @ [Entry time]
Exit: [Exit price] @ [Exit time]
PnL: $[Amount] ([X]R)

What Worked:
✅ [What went well in this trade]

What Didn't:
❌ [What could have been better]

Key Lesson:
[One main takeaway from this trade]

Next Time:
[What you'll do differently next time]`
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'End-of-week performance review',
    category: 'weekly',
    template: `Weekly Trading Review - Week of [DATE]

📈 Weekly Stats:
- Total P&L: $[Amount]
- Win Rate: [X]%
- Best Trade: [Description]
- Worst Trade: [Description]

🎯 Strengths This Week:
1. [Top strength - e.g., "Patience on entries", "Level-based trading"]
2. [Second strength]
3. [Third strength]

⚠️ Weaknesses This Week:
1. [Top weakness - e.g., "Premature breakeven stops", "Hesitation on A+ setups"]
2. [Second weakness]
3. [Third weakness]

📚 Key Lessons:
- [Lesson 1]
- [Lesson 2]
- [Lesson 3]

🎯 Focus for Next Week:
1. [Primary focus area]
2. [Secondary focus area]

Process Score Trend: [Comment on whether you're improving]`
  },
  {
    id: 'quick-log',
    name: 'Quick Trade Log',
    description: 'Minimal template for quick logging',
    category: 'quick',
    template: `Trading Journal - [DATE]

Conviction: [Bullish/Bearish/Neutral]

Trades:
1. [Symbol] [Long/Short] @ [Entry] → [Exit] | PnL: $[Amount] | [R]R
2. [Symbol] [Long/Short] @ [Entry] → [Exit] | PnL: $[Amount] | [R]R

Key Takeaway: [One main lesson from today]`
  },
  {
    id: 'premarket-plan',
    name: 'Premarket Gameplan',
    description: 'Pre-market planning template',
    category: 'daily',
    template: `Premarket Gameplan - [DATE]

📊 Market Context:
- Overnight Range: [High] - [Low]
- Key Levels: [List 3-5 key levels]
- Market Structure: [Bullish/Bearish/Neutral/Choppy]

🎯 Trading Plan:
- Bias: [Bullish/Bearish/Neutral]
- Key Setup: [What you're looking for]
- Risk Cap: $[Amount]
- Max Stop: [X] points
- Position Size: [X] NQ/MNQ

📅 Market Events:
- [Economic data releases, earnings, etc.]

✅ Rules for Today:
1. [Rule 1 - e.g., "No trading first 5 minutes"]
2. [Rule 2 - e.g., "Wait for candle closure"]
3. [Rule 3 - e.g., "Max 1NQ size"]

🎯 Focus Areas:
- [What to focus on today based on recent weaknesses]`
  },
  {
    id: 'mistake-analysis',
    name: 'Mistake Analysis',
    description: 'Deep dive into a specific mistake',
    category: 'trade',
    template: `Mistake Analysis - [DATE]

❌ The Mistake:
[Describe the specific mistake - e.g., "Moved stop to breakeven too early on long trade"]

📊 Context:
- Trade: [Symbol] [Long/Short]
- Entry: [Price]
- What Happened: [Detailed description]

🔍 Root Cause:
[Why did this happen? - e.g., "Trading P&L instead of chart", "Emotional decision"]

💡 Impact:
- Financial: $[Amount] lost/left on table
- Process Score: [How this affected your process]

✅ Prevention Plan:
1. [Action 1 to prevent this]
2. [Action 2]
3. [Action 3]

📝 Reminder:
[Create a reminder/rule to follow next time]`
  },
  {
    id: 'win-analysis',
    name: 'Win Analysis',
    description: 'Deep dive into a successful trade',
    category: 'trade',
    template: `Win Analysis - [DATE]

✅ The Win:
[Describe the successful trade]

📊 Trade Details:
- Setup: [What setup you traded]
- Entry: [Price] @ [Time]
- Exit: [Price] @ [Time]
- PnL: $[Amount] ([X]R)

🎯 What Made It Work:
1. [Factor 1 - e.g., "Waited for proper retest"]
2. [Factor 2 - e.g., "Trusted key level"]
3. [Factor 3 - e.g., "Let trade breathe"]

💡 Replicable Elements:
[What can you repeat from this trade?]

📈 Process Score Impact:
[How this trade reflects good process]

🔄 How to Repeat:
[Action plan to replicate this success]`
  }
];

export function getTemplateById(id: string): JournalTemplate | undefined {
  return JOURNAL_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: JournalTemplate['category']): JournalTemplate[] {
  return JOURNAL_TEMPLATES.filter(t => t.category === category);
}

export function formatTemplate(template: string, date?: string): string {
  const today = date || new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  return template.replace(/\[DATE\]/g, today)
    .replace(/\[TIME\]/g, new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
}


