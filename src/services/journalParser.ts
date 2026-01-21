/**
 * Parser for Discord-style trading journal entries
 * Extracts structured data from free-form journal text
 */

import { JournalEntry } from '../types/journal';

interface ParsedJournal {
  date: string;
  conviction: string;
  setupDetails: {
    entry?: string;
    positionSize?: string;
    risk?: string;
    exit?: string;
  };
  lessons: string[];
  execution: {
    morning?: string;
    afternoon?: string;
    night?: string;
  };
  tradeManagement?: string;
  missedOpportunities?: string;
  finalThoughts?: string;
  rawContent: string;
}

export function parseDiscordJournal(rawText: string): ParsedJournal[] {
  const entries: ParsedJournal[] = [];
  
  // Split by "Trading Journal" markers or date patterns
  const splitPattern = /(?=Trading Journal[\s–-]*[A-Za-z]+\s+\d{1,2}[,\s]+\d{4})/i;
  let journalBlocks = rawText.split(splitPattern);
  
  // If no splits found, try splitting by date patterns
  if (journalBlocks.length === 1) {
    journalBlocks = rawText.split(/(?=[A-Za-z]+\s+\d{1,2}[,\s]+\d{4})/);
  }
  
  for (const block of journalBlocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 50) continue;
    
    // Skip if it doesn't look like a journal entry
    if (!trimmed.match(/conviction|setup|entry|exit|lesson|execution/i)) continue;
    
    const entry: ParsedJournal = {
      date: extractDate(trimmed),
      conviction: extractConviction(trimmed),
      setupDetails: extractSetupDetails(trimmed),
      lessons: extractLessons(trimmed),
      execution: extractExecution(trimmed),
      tradeManagement: extractTradeManagement(trimmed),
      missedOpportunities: extractMissedOpportunities(trimmed),
      finalThoughts: extractFinalThoughts(trimmed),
      rawContent: trimmed
    };
    
    if (entry.date) {
      entries.push(entry);
    }
  }
  
  return entries;
}

function extractDate(text: string): string {
  // Look for dates like "March 21, 2025" or "May 8, 2025"
  const monthNames: Record<string, string> = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12'
  };
  
  // Pattern 1: "Trading Journal - March 21, 2025" or "March 21, 2025"
  const pattern1 = /(?:Trading Journal[\s–-]*)?([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{4})/i;
  const match1 = text.match(pattern1);
  if (match1) {
    const monthName = match1[1].toLowerCase();
    const day = match1[2].padStart(2, '0');
    const year = match1[3];
    const month = monthNames[monthName];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // Pattern 2: "May 8, 2025" (without "Trading Journal")
  const pattern2 = /^([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{4})/;
  const match2 = text.match(pattern2);
  if (match2) {
    const monthName = match2[1].toLowerCase();
    const day = match2[2].padStart(2, '0');
    const year = match2[3];
    const month = monthNames[monthName];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // Pattern 3: MM/DD/YYYY
  const pattern3 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const match3 = text.match(pattern3);
  if (match3) {
    const [_, month, day, year] = match3;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Pattern 4: YYYY-MM-DD
  const pattern4 = /(\d{4})-(\d{2})-(\d{2})/;
  const match4 = text.match(pattern4);
  if (match4) {
    return match4[0];
  }
  
  return new Date().toISOString().split('T')[0]; // Default to today
}

function extractConviction(text: string): string {
  const patterns = [
    /Overall Conviction[:\s]*([^\n]+)/i,
    /Conviction[:\s]*([^\n]+)/i,
    /Bias[:\s]*([^\n]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  return '';
}

function extractSetupDetails(text: string): ParsedJournal['setupDetails'] {
  const details: ParsedJournal['setupDetails'] = {};
  
  const entryMatch = text.match(/Entry[:\s]*([^\n]+)/i);
  if (entryMatch) details.entry = entryMatch[1].trim();
  
  const sizeMatch = text.match(/(?:Position Size|Size)[:\s]*([^\n]+)/i);
  if (sizeMatch) details.positionSize = sizeMatch[1].trim();
  
  const riskMatch = text.match(/Risk[:\s]*([^\n]+)/i);
  if (riskMatch) details.risk = riskMatch[1].trim();
  
  const exitMatch = text.match(/Exit[:\s]*([^\n]+)/i);
  if (exitMatch) details.exit = exitMatch[1].trim();
  
  return details;
}

/**
 * Extract quant metrics from journal entry text
 */
export function extractQuantMetrics(text: string): import('../types/journal').QuantMetrics {
  const metrics: import('../types/journal').QuantMetrics = {};
  
  // Extract position size
  const sizeMatch = text.match(/(?:Position Size|Size)[:\s]*([^\n]+)/i);
  if (sizeMatch) {
    metrics.positionSize = sizeMatch[1].trim();
  }
  
  // Extract risk points (e.g., "12.5 points", "25 points", "12.5-25 points")
  const riskMatch = text.match(/Risk[:\s]*([^\n]+)/i);
  if (riskMatch) {
    const riskText = riskMatch[1].trim();
    const pointsMatch = riskText.match(/(\d+(?:\.\d+)?)\s*points?/i);
    if (pointsMatch) {
      metrics.riskPoints = parseFloat(pointsMatch[1]);
    }
  }
  
  // Extract exit points (e.g., "50 points", "2R", "1.5R", "S/L", "B/E")
  const exitMatch = text.match(/Exit[:\s]*([^\n]+)/i);
  if (exitMatch) {
    const exitText = exitMatch[1].trim();
    
    // Check for R multiples (e.g., "2R", "1.5R", "3R+")
    const rMatch = exitText.match(/(\d+(?:\.\d+)?)\s*R/i);
    if (rMatch && metrics.riskPoints) {
      metrics.exitPoints = parseFloat(rMatch[1]) * metrics.riskPoints;
      metrics.riskRewardRatio = parseFloat(rMatch[1]);
    } else {
      // Check for point values
      const pointsMatch = exitText.match(/(\d+(?:\.\d+)?)\s*points?/i);
      if (pointsMatch && metrics.riskPoints) {
        metrics.exitPoints = parseFloat(pointsMatch[1]);
        metrics.riskRewardRatio = metrics.exitPoints / metrics.riskPoints;
      }
    }
    
    // Determine win/loss
    if (exitText.match(/S\/L|stop|stopped out|loss/i)) {
      metrics.winLoss = 'loss';
    } else if (exitText.match(/B\/E|breakeven|BE/i)) {
      metrics.winLoss = 'breakeven';
    } else if (exitText.match(/\d+\s*R|\d+\s*points?/i)) {
      metrics.winLoss = 'win';
    }
  }
  
  // Extract entry type
  const entryMatch = text.match(/Entry[:\s]*([^\n]+)/i);
  if (entryMatch) {
    metrics.entryType = entryMatch[1].trim();
  }
  
  // Extract timeframe
  const timeframeMatch = text.match(/(?:Entry|Setup Details)[:\s]*([^\n]*?)(?:\d+min|\d+hr|1min|5min|15min|30min|1hr|4hr)/i);
  if (timeframeMatch) {
    const timeframeText = text.match(/(\d+min(?:-\d+min)?(?:-\d+min)?(?:-\d+hr)?(?:-\d+hr)?)/i);
    if (timeframeText) {
      metrics.timeframe = timeframeText[1];
    }
  }
  
  // Extract setup type
  const setupMatch = text.match(/Setup Details[:\s]*([^\n]+)/i);
  if (setupMatch) {
    const setupText = setupMatch[1].toLowerCase();
    if (setupText.includes('bull flag')) metrics.setupType = 'Bull Flag';
    else if (setupText.includes('bear flag')) metrics.setupType = 'Bear Flag';
    else if (setupText.includes('retest')) metrics.setupType = 'Retest';
    else if (setupText.includes('breakdown')) metrics.setupType = 'Breakdown';
    else if (setupText.includes('breakout')) metrics.setupType = 'Breakout';
    else if (setupText.includes('continuation')) metrics.setupType = 'Continuation';
  }
  
  // Extract market condition
  const conditionMatch = text.match(/(?:chop|choppy|volatile|trending|momentum|consolidation)/i);
  if (conditionMatch) {
    metrics.marketCondition = conditionMatch[0].charAt(0).toUpperCase() + conditionMatch[0].slice(1);
  }
  
  return metrics;
}

function extractLessons(text: string): string[] {
  const lessons: string[] = [];
  
  // Look for "Lessons Learned" section
  const lessonsSection = text.match(/Lessons Learned[:\s]*([\s\S]*?)(?=Execution|Trade management|Missed|Final|$)/i);
  if (lessonsSection) {
    const content = lessonsSection[1];
    // Split by numbered items, bullets, or new lines
    const items = content.split(/(?:\d+[\.\)]|\u2022|\u25CF|[-*])\s*/).filter(item => item.trim().length > 10);
    lessons.push(...items.map(item => item.trim()));
  }
  
  // Also look for "Lesson" patterns
  const lessonMatches = text.matchAll(/Lesson\s*\d*[:\s]*([^\n]+)/gi);
  for (const match of lessonMatches) {
    if (match[1].trim().length > 10) {
      lessons.push(match[1].trim());
    }
  }
  
  return lessons.filter((l, i, arr) => arr.indexOf(l) === i); // Remove duplicates
}

function extractExecution(text: string): ParsedJournal['execution'] {
  const execution: ParsedJournal['execution'] = {};
  
  const morningMatch = text.match(/Morning Session[:\s]*([^\n]+(?:\n(?!Afternoon|Night|Trade|Missed|Final)[^\n]+)*)/i);
  if (morningMatch) execution.morning = morningMatch[1].trim();
  
  const afternoonMatch = text.match(/Afternoon Session[:\s]*([^\n]+(?:\n(?!Night|Trade|Missed|Final)[^\n]+)*)/i);
  if (afternoonMatch) execution.afternoon = afternoonMatch[1].trim();
  
  const nightMatch = text.match(/Night Session[:\s]*([^\n]+(?:\n(?!Trade|Missed|Final)[^\n]+)*)/i);
  if (nightMatch) execution.night = nightMatch[1].trim();
  
  return execution;
}

function extractTradeManagement(text: string): string | undefined {
  const match = text.match(/Trade management[:\s]*([^\n]+(?:\n(?!Missed|Final)[^\n]+)*)/i);
  return match ? match[1].trim() : undefined;
}

function extractMissedOpportunities(text: string): string | undefined {
  const match = text.match(/Missed Opportunities?[:\s]*([^\n]+(?:\n(?!Final)[^\n]+)*)/i);
  return match ? match[1].trim() : undefined;
}

function extractFinalThoughts(text: string): string | undefined {
  const match = text.match(/Final Thoughts?[:\s]*([\s\S]*?)(?=Trading Journal|$)/i);
  return match ? match[1].trim() : undefined;
}

export function convertToJournalEntries(parsed: ParsedJournal[]): JournalEntry[] {
  return parsed.map((entry, index) => ({
    id: `journal-${Date.now()}-${index}`,
    date: entry.date,
    content: entry.rawContent,
    quantMetrics: extractQuantMetrics(entry.rawContent),
    createdAt: new Date().toISOString()
  }));
}

