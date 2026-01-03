import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Calendar, ClipboardList, Save, Trash2, Eye, EyeOff, Plus, X, Download } from 'lucide-react';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import jsPDF from 'jspdf';

interface KeyLevel {
  id: string;
  type: 'support' | 'resistance' | 'poc' | 'vwap' | 'pivot' | 'fair-value-gap' | 'liquidity-zone' | 'order-block' | 'other';
  price: string;
  label?: string;
  strength?: 'weak' | 'moderate' | 'strong';
  timeframe?: string;
}

interface OvernightSession {
  high: string;
  low: string;
  close: string;
  range: string;
  volume?: string;
}

interface GapAnalysis {
  gapSize: string;
  gapDirection: 'up' | 'down' | 'none';
  gapFillProbability: 'low' | 'medium' | 'high';
  gapFillTarget?: string;
}

interface QuantMetrics {
  atr: string;
  volatility: 'low' | 'normal' | 'high' | 'extreme';
  volumeProfile: string;
  marketStructure: 'bullish' | 'bearish' | 'neutral' | 'choppy';
}

interface TradingPlan {
  entryZones: string;
  stopLoss: string;
  targets: string;
  positionSize: string;
  rMultiple: string;
  trailingStop?: string;
  scalingRules?: string;
}

interface DailyAnalysis {
  date: string;
  contractType: 'NQ' | 'MNQ' | 'ES' | 'MES' | 'other';
  keyLevels: KeyLevel[];
  marketEvents: string[];
  biasDirection: 'bullish' | 'bearish' | 'neutral';
  tradingPlan: string;
  // Premarket specific
  overnightSession?: OvernightSession;
  gapAnalysis?: GapAnalysis;
  quantMetrics?: QuantMetrics;
  tradingPlanDetails?: TradingPlan;
  premarketNotes?: string;
  sessionExpectation?: 'trending' | 'choppy' | 'breakout' | 'consolidation';
  weeklyStructure?: 'bullish' | 'bearish' | 'neutral';
}

interface WatchlistItem {
  id: string;
  symbol: string;
  assetType: 'Futures' | 'Stock' | 'Options' | 'Crypto' | 'Forex';
  setup: string;
  notes?: string;
}

interface WeeklyKeyLevel {
  id: string;
  type: 'support' | 'resistance' | 'weekly-poc' | 'weekly-vwap' | 'monthly-level' | 'other';
  price: string;
  label?: string;
  timeframe?: string;
}

interface WeeklyRiskParams {
  dailyRiskCap: string;
  maxPositionSize: string;
  maxStopLoss: string;
  maxDailyLoss: string;
  twoStrikeRule: boolean;
  noFirst5Min: boolean;
  noDataCandle: boolean;
}

interface WeeklyPerformanceTargets {
  rMultipleGoal: string;
  winRateGoal: string;
  tradesPerDay: string;
  weeklyProfitTarget: string;
}

interface WeeklyGameplan {
  weekStartDate: string;
  watchlist: WatchlistItem[];
  weeklyBias: string;
  keyEvents: string[];
  goals: string;
  // Quant-specific additions
  weeklyStructure?: 'bullish' | 'bearish' | 'neutral' | 'choppy';
  weeklyKeyLevels?: WeeklyKeyLevel[];
  weeklyATR?: string;
  weeklyVolatility?: 'low' | 'normal' | 'high' | 'extreme';
  weeklyRange?: string;
  riskParams?: WeeklyRiskParams;
  performanceTargets?: WeeklyPerformanceTargets;
  correlationNotes?: string;
  weeklyStrategy?: string;
}

export function Gameplan() {
  const [activeGameplanTab, setActiveGameplanTab] = useState('daily');
  const [showPreview, setShowPreview] = useState(false);
  
  // Daily Analysis State
  const [selectedAnalysisDate, setSelectedAnalysisDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [dailyAnalyses, setDailyAnalyses] = useState<Record<string, DailyAnalysis>>(() => {
    const saved = localStorage.getItem('tradingJournal_dailyAnalyses');
    return saved ? JSON.parse(saved) : {};
  });

  const currentAnalysis: DailyAnalysis = dailyAnalyses[selectedAnalysisDate] || {
    date: selectedAnalysisDate,
    contractType: 'NQ',
    keyLevels: [] as KeyLevel[],
    marketEvents: [] as string[],
    biasDirection: 'neutral' as const,
    tradingPlan: '',
    overnightSession: {
      high: '',
      low: '',
      close: '',
      range: '',
      volume: '',
    },
    gapAnalysis: {
      gapSize: '',
      gapDirection: 'none',
      gapFillProbability: 'medium',
    },
    quantMetrics: {
      atr: '',
      volatility: 'normal',
      volumeProfile: '',
      marketStructure: 'neutral',
    },
    tradingPlanDetails: {
      entryZones: '',
      stopLoss: '',
      targets: '',
      positionSize: '',
      rMultiple: '',
    },
    sessionExpectation: 'trending',
    weeklyStructure: 'neutral',
  };

  // Weekly Gameplan State
  const [weeklyGameplans, setWeeklyGameplans] = useState<Record<string, WeeklyGameplan>>(() => {
    const saved = localStorage.getItem('tradingJournal_weeklyGameplans');
    return saved ? JSON.parse(saved) : {};
  });

  const getCurrentWeekStart = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const [currentWeekStart, setCurrentWeekStart] = useState(getCurrentWeekStart());
  
  const currentWeekly = weeklyGameplans[currentWeekStart] || {
    weekStartDate: currentWeekStart,
    watchlist: [] as WatchlistItem[],
    weeklyBias: '',
    keyEvents: [] as string[],
    goals: '',
  };

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('tradingJournal_dailyAnalyses', JSON.stringify(dailyAnalyses));
  }, [dailyAnalyses]);

  useEffect(() => {
    localStorage.setItem('tradingJournal_weeklyGameplans', JSON.stringify(weeklyGameplans));
  }, [weeklyGameplans]);

  // Daily Analysis Handlers
  const updateDailyAnalysis = (field: keyof DailyAnalysis, value: any) => {
    setDailyAnalyses(prev => ({
      ...prev,
      [selectedAnalysisDate]: {
        ...(prev[selectedAnalysisDate] || currentAnalysis),
        [field]: value,
      },
    }));
  };

  const toggleMarketEvent = (event: string) => {
    const currentEvents = currentAnalysis.marketEvents || [];
    const newEvents = currentEvents.includes(event)
      ? currentEvents.filter(e => e !== event)
      : [...currentEvents, event];
    updateDailyAnalysis('marketEvents', newEvents);
  };

  const availableMarketEvents = [
    '10:00 AM Economic Data',
    'FOMC Meeting',
    'CPI Release',
    'Jobs Report',
    'Earnings Season',
    'Fed Speech',
    'PMI Data',
    'Retail Sales',
    'GDP Report',
    'Holiday (Low Volume)',
  ];

  // Key Levels Handlers
  const addKeyLevel = () => {
    const newLevel: KeyLevel = {
      id: Date.now().toString(),
      type: 'support',
      price: '',
      label: '',
    };
    const updatedLevels = [...(currentAnalysis.keyLevels || []), newLevel];
    updateDailyAnalysis('keyLevels', updatedLevels);
  };

  const updateKeyLevel = (id: string, field: keyof KeyLevel, value: string) => {
    const updatedLevels = (currentAnalysis.keyLevels || []).map(level =>
      level.id === id ? { ...level, [field]: value } : level
    );
    updateDailyAnalysis('keyLevels', updatedLevels);
  };

  const deleteKeyLevel = (id: string) => {
    const updatedLevels = (currentAnalysis.keyLevels || []).filter(level => level.id !== id);
    updateDailyAnalysis('keyLevels', updatedLevels);
  };

  const getLevelTypeColor = (type: KeyLevel['type']) => {
    switch (type) {
      case 'support':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'resistance':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'poc':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'vwap':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'pivot':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'fair-value-gap':
        return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
      case 'liquidity-zone':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'order-block':
        return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getLevelTypeLabel = (type: KeyLevel['type']) => {
    switch (type) {
      case 'support':
        return 'Support';
      case 'resistance':
        return 'Resistance';
      case 'poc':
        return 'POC';
      case 'vwap':
        return 'VWAP';
      case 'pivot':
        return 'Pivot';
      case 'fair-value-gap':
        return 'Fair Value Gap';
      case 'liquidity-zone':
        return 'Liquidity Zone';
      case 'order-block':
        return 'Order Block';
      default:
        return 'Other';
    }
  };

  const deleteDailyAnalysis = () => {
    if (window.confirm('Delete this daily analysis?')) {
      const updated = { ...dailyAnalyses };
      delete updated[selectedAnalysisDate];
      setDailyAnalyses(updated);
    }
  };

  // Weekly Gameplan Handlers
  const updateWeeklyGameplan = (field: keyof WeeklyGameplan, value: string | string[] | WatchlistItem[]) => {
    setWeeklyGameplans(prev => ({
      ...prev,
      [currentWeekStart]: {
        ...currentWeekly,
        [field]: value,
      },
    }));
  };

  const deleteWeeklyGameplan = () => {
    if (window.confirm('Delete this weekly gameplan?')) {
      const updated = { ...weeklyGameplans };
      delete updated[currentWeekStart];
      setWeeklyGameplans(updated);
    }
  };

  // Watchlist Item Handlers
  const addWatchlistItem = () => {
    const newItem: WatchlistItem = {
      id: Date.now().toString(),
      symbol: '',
      assetType: 'Stock',
      setup: '',
      notes: '',
    };
    const updatedWatchlist = [...(currentWeekly.watchlist || []), newItem];
    updateWeeklyGameplan('watchlist', updatedWatchlist);
  };

  const updateWatchlistItem = (id: string, field: keyof WatchlistItem, value: string) => {
    const updatedWatchlist = (currentWeekly.watchlist || []).map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    updateWeeklyGameplan('watchlist', updatedWatchlist);
  };

  const deleteWatchlistItem = (id: string) => {
    const updatedWatchlist = (currentWeekly.watchlist || []).filter(item => item.id !== id);
    updateWeeklyGameplan('watchlist', updatedWatchlist);
  };

  const toggleWeeklyEvent = (event: string) => {
    const currentEvents = currentWeekly.keyEvents || [];
    const newEvents = currentEvents.includes(event)
      ? currentEvents.filter(e => e !== event)
      : [...currentEvents, event];
    updateWeeklyGameplan('keyEvents', newEvents);
  };

  // Weekly Key Levels Handlers
  const addWeeklyKeyLevel = () => {
    const newLevel: WeeklyKeyLevel = {
      id: Date.now().toString(),
      type: 'support',
      price: '',
      label: '',
    };
    const updatedLevels = [...(currentWeekly.weeklyKeyLevels || []), newLevel];
    updateWeeklyGameplan('weeklyKeyLevels', updatedLevels);
  };

  const updateWeeklyKeyLevel = (id: string, field: keyof WeeklyKeyLevel, value: string) => {
    const updatedLevels = (currentWeekly.weeklyKeyLevels || []).map(level =>
      level.id === id ? { ...level, [field]: value } : level
    );
    updateWeeklyGameplan('weeklyKeyLevels', updatedLevels);
  };

  const deleteWeeklyKeyLevel = (id: string) => {
    const updatedLevels = (currentWeekly.weeklyKeyLevels || []).filter(level => level.id !== id);
    updateWeeklyGameplan('weeklyKeyLevels', updatedLevels);
  };

  const getWeeklyLevelTypeLabel = (type: WeeklyKeyLevel['type']) => {
    switch (type) {
      case 'support':
        return 'Support';
      case 'resistance':
        return 'Resistance';
      case 'weekly-poc':
        return 'Weekly POC';
      case 'weekly-vwap':
        return 'Weekly VWAP';
      case 'monthly-level':
        return 'Monthly Level';
      default:
        return 'Other';
    }
  };

  const availableWeeklyEvents = [
    'FOMC Meeting',
    'CPI Release',
    'Jobs Report',
    'Fed Speech',
    'PMI Data',
    'GDP Report',
    'Retail Sales',
    'PCE Data',
    'PPI Data',
    'Earnings Season',
  ];

  const getAssetTypeColor = (assetType: WatchlistItem['assetType']) => {
    switch (assetType) {
      case 'Futures':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'Stock':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'Options':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'Crypto':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'Forex':
        return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(currentWeekStart);
    const daysToAdd = direction === 'next' ? 7 : -7;
    current.setDate(current.getDate() + daysToAdd);
    setCurrentWeekStart(current.toISOString().split('T')[0]);
  };

  const formatWeekRange = (weekStart: string) => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = 20;

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Helper function to render multi-line text with proper line break handling
    const renderMultiLineText = (text: string, maxWidth: number, lineHeight: number = 5) => {
      // Split by actual newline characters first
      const paragraphs = text.split('\n');
      
      paragraphs.forEach((paragraph) => {
        if (paragraph.trim() === '') {
          // Empty line - just add spacing
          checkPageBreak(lineHeight);
          yPos += lineHeight;
        } else {
          // Wrap this paragraph based on width
          const wrappedLines = doc.splitTextToSize(paragraph, maxWidth);
          wrappedLines.forEach((line: string) => {
            checkPageBreak(lineHeight + 2);
            doc.text(line, margin + 5, yPos);
            yPos += lineHeight;
          });
        }
      });
    };

    // Diamond SVG function - draws a gem/diamond shape
    const drawDiamond = (x: number, y: number, size: number, color: string) => {
      doc.setFillColor(color);
      doc.triangle(x, y - size/2, x - size/2, y, x, y + size/2, 'F'); // Left facet
      doc.triangle(x, y - size/2, x + size/2, y, x, y + size/2, 'F'); // Right facet
    };

    // === HEADER WITH GEMS BRANDING ===
    // Gradient-like header background
    doc.setFillColor(15, 23, 42); // Dark blue-gray
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Diamond accents in header
    drawDiamond(15, 22, 8, '#3b82f6'); // Blue diamond
    drawDiamond(pageWidth - 15, 22, 8, '#06b6d4'); // Cyan diamond
    
    // GEMS Title
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('GEMS', pageWidth / 2, 20, { align: 'center' });
    
    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate gray
    doc.text('Golden Era Market Strategies', pageWidth / 2, 28, { align: 'center' });
    
    // Trading Gameplan subtitle
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Trading Gameplan', pageWidth / 2, 37, { align: 'center' });

    yPos = 55;

    // === DAILY ANALYSIS SECTION ===
    if (dailyAnalyses[selectedAnalysisDate]) {
      const analysis = dailyAnalyses[selectedAnalysisDate];
      
      // Section header with diamond
      doc.setFillColor(59, 130, 246); // Blue
      doc.roundedRect(margin, yPos, pageWidth - (2 * margin), 10, 2, 2, 'F');
      drawDiamond(margin + 5, yPos + 5, 5, '#ffffff');
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Analysis', margin + 12, yPos + 7);
      
      yPos += 15;
      
      // Date
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${new Date(selectedAnalysisDate).toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      })}`, margin, yPos);
      yPos += 10;
      
      // Market Bias
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.text('Market Bias:', margin, yPos);
      
      const biasColors: Record<string, string> = {
        bullish: '#16a34a',
        bearish: '#dc2626',
        neutral: '#3b82f6'
      };
      const biasColor = biasColors[analysis.biasDirection] || '#6b7280';
      doc.setTextColor(biasColor);
      doc.text(analysis.biasDirection.toUpperCase(), margin + 35, yPos);
      yPos += 10;
      
      // Key Levels
      if (analysis.keyLevels && analysis.keyLevels.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Levels:', margin, yPos);
        yPos += 7;
        
        analysis.keyLevels.forEach((level) => {
          checkPageBreak(8);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          
          const levelColors: Record<string, string> = {
            support: '#16a34a',
            resistance: '#dc2626',
            poc: '#3b82f6',
            vwap: '#9333ea',
            pivot: '#eab308',
            other: '#6b7280'
          };
          
          doc.setTextColor(levelColors[level.type] || '#6b7280');
          doc.text(`• ${getLevelTypeLabel(level.type)}: ${level.price}`, margin + 5, yPos);
          yPos += 6;
          
          // Handle multi-line label if present
          if (level.label && level.label.trim()) {
            doc.setTextColor(71, 85, 105);
            doc.setFontSize(9);
            const labelLines = level.label.split('\n');
            labelLines.forEach((labelLine) => {
              if (labelLine.trim()) {
                const wrappedLines = doc.splitTextToSize(labelLine, pageWidth - (2 * margin) - 15);
                wrappedLines.forEach((line: string) => {
                  checkPageBreak(5);
                  doc.text(line, margin + 10, yPos);
                  yPos += 5;
                });
              } else {
                yPos += 3;
              }
            });
            doc.setFontSize(10);
          }
          yPos += 2;
        });
        yPos += 5;
      }
      
      // Trading Plan
      if (analysis.tradingPlan) {
        checkPageBreak(30);
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text('Trading Plan:', margin, yPos);
        yPos += 7;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        renderMultiLineText(analysis.tradingPlan, pageWidth - (2 * margin) - 5);
        yPos += 5;
      }
      
      // Market Events
      if (analysis.marketEvents && analysis.marketEvents.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text('Market Events Today:', margin, yPos);
        yPos += 7;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        analysis.marketEvents.forEach((event) => {
          checkPageBreak(6);
          doc.text(`• ${event}`, margin + 5, yPos);
          yPos += 6;
        });
        yPos += 5;
      }
      
      yPos += 10;
    }

    // === WEEKLY GAMEPLAN SECTION ===
    if (weeklyGameplans[currentWeekStart]) {
      checkPageBreak(40);
      const weekly = weeklyGameplans[currentWeekStart];
      
      // Section header with diamond
      doc.setFillColor(6, 182, 212); // Cyan
      doc.roundedRect(margin, yPos, pageWidth - (2 * margin), 10, 2, 2, 'F');
      drawDiamond(margin + 5, yPos + 5, 5, '#ffffff');
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Weekly Gameplan', margin + 12, yPos + 7);
      
      yPos += 15;
      
      // Week Range
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(`Week: ${formatWeekRange(currentWeekStart)}`, margin, yPos);
      yPos += 10;
      
      // Watchlist
      if (weekly.watchlist && weekly.watchlist.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text('Watchlist:', margin, yPos);
        yPos += 7;
        
        weekly.watchlist.forEach((item) => {
          checkPageBreak(10);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(51, 65, 85);
          doc.text(`${item.symbol} (${item.assetType})`, margin + 5, yPos);
          yPos += 5;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          
          // Handle multi-line setup
          if (item.setup) {
            doc.text('Setup:', margin + 10, yPos);
            yPos += 5;
            const setupParagraphs = item.setup.split('\n');
            setupParagraphs.forEach((para) => {
              if (para.trim()) {
                const wrappedLines = doc.splitTextToSize(para, pageWidth - (2 * margin) - 15);
                wrappedLines.forEach((line: string) => {
                  checkPageBreak(5);
                  doc.text(line, margin + 15, yPos);
                  yPos += 5;
                });
              } else {
                yPos += 3;
              }
            });
          }
          
          if (item.notes) {
            doc.text('Notes:', margin + 10, yPos);
            yPos += 5;
            const notesParagraphs = item.notes.split('\n');
            notesParagraphs.forEach((para) => {
              if (para.trim()) {
                const wrappedLines = doc.splitTextToSize(para, pageWidth - (2 * margin) - 15);
                wrappedLines.forEach((line: string) => {
                  checkPageBreak(5);
                  doc.text(line, margin + 15, yPos);
                  yPos += 5;
                });
              } else {
                yPos += 3;
              }
            });
          }
          yPos += 3;
        });
        yPos += 5;
      }
      
      // Weekly Bias
      if (weekly.weeklyBias) {
        checkPageBreak(30);
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text('Weekly Bias & Strategy:', margin, yPos);
        yPos += 7;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        renderMultiLineText(weekly.weeklyBias, pageWidth - (2 * margin) - 5);
        yPos += 5;
      }
      
      // Key Events
      if (weekly.keyEvents && weekly.keyEvents.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Events This Week:', margin, yPos);
        yPos += 7;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        weekly.keyEvents.forEach((event) => {
          checkPageBreak(6);
          doc.text(`• ${event}`, margin + 5, yPos);
          yPos += 6;
        });
        yPos += 5;
      }
      
      // Weekly Goals
      if (weekly.goals) {
        checkPageBreak(30);
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text('Weekly Goals:', margin, yPos);
        yPos += 7;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        renderMultiLineText(weekly.goals, pageWidth - (2 * margin) - 5);
      }
    }

    // === FOOTER ===
    const totalPages = (doc as any).internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      // Footer text
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'italic');
      doc.text('GEMS - Golden Era Market Strategies', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Page number
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      
      // Small diamonds in footer corners
      drawDiamond(margin + 3, pageHeight - 10, 3, '#94a3b8');
      drawDiamond(pageWidth - margin - 3, pageHeight - 10, 3, '#94a3b8');
    }

    // Generate filename with date
    const filename = `GEMS_Gameplan_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
            Premarket Gameplan
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Quant-focused premarket analysis for NQ/Futures trading
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPDF}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeGameplanTab} onValueChange={setActiveGameplanTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily" className="gap-2">
            <Calendar className="w-4 h-4" />
            Daily Analysis
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Weekly Watchlist
          </TabsTrigger>
        </TabsList>

        {/* Daily Analysis Tab */}
        <TabsContent value="daily" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle>Premarket Analysis</CardTitle>
                  <CardDescription className="mt-1">
                    Overnight session data, gap analysis, and quant metrics for NQ/Futures
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedAnalysisDate}
                    onChange={(e) => setSelectedAnalysisDate(e.target.value)}
                    className="px-3 py-2 rounded-lg border bg-input-background text-sm"
                  />
                  {dailyAnalyses[selectedAnalysisDate] && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={deleteDailyAnalysis}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contract Type & Bias */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contract Type</Label>
                  <Select
                    value={currentAnalysis.contractType || 'NQ'}
                    onValueChange={(value) => updateDailyAnalysis('contractType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NQ">NQ (Nasdaq-100)</SelectItem>
                      <SelectItem value="MNQ">MNQ (Micro Nasdaq)</SelectItem>
                      <SelectItem value="ES">ES (S&P 500)</SelectItem>
                      <SelectItem value="MES">MES (Micro S&P)</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Market Bias</Label>
                  <div className="flex gap-2">
                    {(['bullish', 'neutral', 'bearish'] as const).map((bias) => (
                      <Button
                        key={bias}
                        variant={currentAnalysis.biasDirection === bias ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateDailyAnalysis('biasDirection', bias)}
                        className={
                          currentAnalysis.biasDirection === bias
                            ? bias === 'bullish'
                              ? 'bg-green-600 hover:bg-green-700'
                              : bias === 'bearish'
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                            : ''
                        }
                      >
                        {bias.charAt(0).toUpperCase() + bias.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weekly Structure & Session Expectation */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weekly Structure</Label>
                  <Select
                    value={currentAnalysis.weeklyStructure || 'neutral'}
                    onValueChange={(value) => updateDailyAnalysis('weeklyStructure', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bullish">Bullish</SelectItem>
                      <SelectItem value="bearish">Bearish</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Session Expectation</Label>
                  <Select
                    value={currentAnalysis.sessionExpectation || 'trending'}
                    onValueChange={(value) => updateDailyAnalysis('sessionExpectation', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trending">Trending</SelectItem>
                      <SelectItem value="choppy">Choppy</SelectItem>
                      <SelectItem value="breakout">Breakout</SelectItem>
                      <SelectItem value="consolidation">Consolidation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Overnight Session Data */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">🌙 Overnight Session (Globex)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">High</Label>
                      <Input
                        type="text"
                        placeholder="e.g., 20,450"
                        value={currentAnalysis.overnightSession?.high || ''}
                        onChange={(e) => updateDailyAnalysis('overnightSession', {
                          ...currentAnalysis.overnightSession,
                          high: e.target.value,
                        })}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Low</Label>
                      <Input
                        type="text"
                        placeholder="e.g., 20,350"
                        value={currentAnalysis.overnightSession?.low || ''}
                        onChange={(e) => updateDailyAnalysis('overnightSession', {
                          ...currentAnalysis.overnightSession,
                          low: e.target.value,
                        })}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Close</Label>
                      <Input
                        type="text"
                        placeholder="e.g., 20,400"
                        value={currentAnalysis.overnightSession?.close || ''}
                        onChange={(e) => updateDailyAnalysis('overnightSession', {
                          ...currentAnalysis.overnightSession,
                          close: e.target.value,
                        })}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Range</Label>
                      <Input
                        type="text"
                        placeholder="Auto-calc"
                        value={currentAnalysis.overnightSession?.range || ''}
                        onChange={(e) => updateDailyAnalysis('overnightSession', {
                          ...currentAnalysis.overnightSession,
                          range: e.target.value,
                        })}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gap Analysis */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">📊 Gap Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Gap Size (points)</Label>
                      <Input
                        type="text"
                        placeholder="e.g., +50"
                        value={currentAnalysis.gapAnalysis?.gapSize || ''}
                        onChange={(e) => updateDailyAnalysis('gapAnalysis', {
                          ...currentAnalysis.gapAnalysis,
                          gapSize: e.target.value,
                        })}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gap Direction</Label>
                      <Select
                        value={currentAnalysis.gapAnalysis?.gapDirection || 'none'}
                        onValueChange={(value) => updateDailyAnalysis('gapAnalysis', {
                          ...currentAnalysis.gapAnalysis,
                          gapDirection: value,
                        })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="up">Gap Up</SelectItem>
                          <SelectItem value="down">Gap Down</SelectItem>
                          <SelectItem value="none">No Gap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fill Probability</Label>
                      <Select
                        value={currentAnalysis.gapAnalysis?.gapFillProbability || 'medium'}
                        onValueChange={(value) => updateDailyAnalysis('gapAnalysis', {
                          ...currentAnalysis.gapAnalysis,
                          gapFillProbability: value,
                        })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gap Fill Target</Label>
                      <Input
                        type="text"
                        placeholder="e.g., 20,380"
                        value={currentAnalysis.gapAnalysis?.gapFillTarget || ''}
                        onChange={(e) => updateDailyAnalysis('gapAnalysis', {
                          ...currentAnalysis.gapAnalysis,
                          gapFillTarget: e.target.value,
                        })}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quant Metrics */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">📈 Quant Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">ATR (14)</Label>
                      <Input
                        type="text"
                        placeholder="e.g., 120"
                        value={currentAnalysis.quantMetrics?.atr || ''}
                        onChange={(e) => updateDailyAnalysis('quantMetrics', {
                          ...currentAnalysis.quantMetrics,
                          atr: e.target.value,
                        })}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Volatility</Label>
                      <Select
                        value={currentAnalysis.quantMetrics?.volatility || 'normal'}
                        onValueChange={(value) => updateDailyAnalysis('quantMetrics', {
                          ...currentAnalysis.quantMetrics,
                          volatility: value,
                        })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="extreme">Extreme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Market Structure</Label>
                      <Select
                        value={currentAnalysis.quantMetrics?.marketStructure || 'neutral'}
                        onValueChange={(value) => updateDailyAnalysis('quantMetrics', {
                          ...currentAnalysis.quantMetrics,
                          marketStructure: value,
                        })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bullish">Bullish</SelectItem>
                          <SelectItem value="bearish">Bearish</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="choppy">Choppy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Volume Profile POC</Label>
                      <Input
                        type="text"
                        placeholder="e.g., 20,400"
                        value={currentAnalysis.quantMetrics?.volumeProfile || ''}
                        onChange={(e) => updateDailyAnalysis('quantMetrics', {
                          ...currentAnalysis.quantMetrics,
                          volumeProfile: e.target.value,
                        })}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {showPreview ? (
                /* Preview Mode */
                <div className="space-y-6">
                  {currentAnalysis.keyLevels && currentAnalysis.keyLevels.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2">
                        🎯 Key Levels
                      </h4>
                      <div className="space-y-2">
                        {currentAnalysis.keyLevels.map((level) => (
                          <div
                            key={level.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${getLevelTypeColor(level.type)}`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="border-current">
                                {getLevelTypeLabel(level.type)}
                              </Badge>
                              <span className="font-mono">{level.price}</span>
                              {level.label && (
                                <span className="text-sm text-muted-foreground">• {level.label}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentAnalysis.tradingPlan && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        📝 Trading Plan
                      </h4>
                      <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap text-sm">
                        {currentAnalysis.tradingPlan}
                      </div>
                    </div>
                  )}

                  {currentAnalysis.marketEvents && currentAnalysis.marketEvents.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        📅 Market Events Today
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {currentAnalysis.marketEvents.map((event) => (
                          <Badge key={event} variant="secondary">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {!currentAnalysis.keyLevels?.length && !currentAnalysis.marketEvents?.length && !currentAnalysis.tradingPlan && (
                    <div className="text-center py-8 text-muted-foreground">
                      No analysis for this day. Switch to Edit mode to add notes.
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Key Levels</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addKeyLevel}
                        className="gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Level
                      </Button>
                    </div>
                    
                    {currentAnalysis.keyLevels && currentAnalysis.keyLevels.length > 0 ? (
                      <div className="space-y-2">
                        {currentAnalysis.keyLevels.map((level) => (
                          <div key={level.id} className="flex gap-2 items-start">
                            <Select
                              value={level.type}
                              onValueChange={(value) => updateKeyLevel(level.id, 'type', value)}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="support">Support</SelectItem>
                                <SelectItem value="resistance">Resistance</SelectItem>
                                <SelectItem value="poc">POC</SelectItem>
                                <SelectItem value="vwap">VWAP</SelectItem>
                                <SelectItem value="pivot">Pivot</SelectItem>
                                <SelectItem value="fair-value-gap">Fair Value Gap</SelectItem>
                                <SelectItem value="liquidity-zone">Liquidity Zone</SelectItem>
                                <SelectItem value="order-block">Order Block</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Input
                              type="text"
                              placeholder="Price"
                              value={level.price}
                              onChange={(e) => updateKeyLevel(level.id, 'price', e.target.value)}
                              className="w-[120px] font-mono"
                            />
                            
                            <Textarea
                              placeholder="Label (optional)"
                              value={level.label || ''}
                              onChange={(e) => updateKeyLevel(level.id, 'label', e.target.value)}
                              className="flex-1 min-h-[40px] resize-y"
                            />
                            
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteKeyLevel(level.id)}
                              className="text-destructive hover:text-destructive shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                        Click "Add Level" to start tracking key price levels
                      </div>
                    )}
                  </div>

                  {/* Enhanced Trading Plan */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">📝 Trading Plan Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Entry Zones</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 20,380-20,400"
                            value={currentAnalysis.tradingPlanDetails?.entryZones || ''}
                            onChange={(e) => updateDailyAnalysis('tradingPlanDetails', {
                              ...currentAnalysis.tradingPlanDetails,
                              entryZones: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Stop Loss</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 20,350"
                            value={currentAnalysis.tradingPlanDetails?.stopLoss || ''}
                            onChange={(e) => updateDailyAnalysis('tradingPlanDetails', {
                              ...currentAnalysis.tradingPlanDetails,
                              stopLoss: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Targets (TP1, TP2, TP3)</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 20,450 / 20,500 / 20,550"
                            value={currentAnalysis.tradingPlanDetails?.targets || ''}
                            onChange={(e) => updateDailyAnalysis('tradingPlanDetails', {
                              ...currentAnalysis.tradingPlanDetails,
                              targets: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Position Size</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 1 NQ or 3 MNQ"
                            value={currentAnalysis.tradingPlanDetails?.positionSize || ''}
                            onChange={(e) => updateDailyAnalysis('tradingPlanDetails', {
                              ...currentAnalysis.tradingPlanDetails,
                              positionSize: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">R-Multiple</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 2R, 3R, 4R"
                            value={currentAnalysis.tradingPlanDetails?.rMultiple || ''}
                            onChange={(e) => updateDailyAnalysis('tradingPlanDetails', {
                              ...currentAnalysis.tradingPlanDetails,
                              rMultiple: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Trailing Stop Rules</Label>
                          <Input
                            type="text"
                            placeholder="e.g., Trail after 2R"
                            value={currentAnalysis.tradingPlanDetails?.trailingStop || ''}
                            onChange={(e) => updateDailyAnalysis('tradingPlanDetails', {
                              ...currentAnalysis.tradingPlanDetails,
                              trailingStop: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Scaling Rules</Label>
                        <Textarea
                          placeholder="e.g., Add 1 contract at TP1, trim 50% at TP2..."
                          value={currentAnalysis.tradingPlanDetails?.scalingRules || ''}
                          onChange={(e) => updateDailyAnalysis('tradingPlanDetails', {
                            ...currentAnalysis.tradingPlanDetails,
                            scalingRules: e.target.value,
                          })}
                          className="min-h-[60px] resize-y text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="tradingPlan">Trading Plan Notes</Label>
                    <Textarea
                      id="tradingPlan"
                      placeholder="Additional notes, market context, psychology reminders..."
                      value={currentAnalysis.tradingPlan}
                      onChange={(e) => updateDailyAnalysis('tradingPlan', e.target.value)}
                      className="min-h-[100px] resize-y"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="premarketNotes">Premarket Notes</Label>
                    <Textarea
                      id="premarketNotes"
                      placeholder="Overnight news, premarket sentiment, key observations..."
                      value={currentAnalysis.premarketNotes || ''}
                      onChange={(e) => updateDailyAnalysis('premarketNotes', e.target.value)}
                      className="min-h-[80px] resize-y"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Market Events Today</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {availableMarketEvents.map((event) => (
                        <div key={event} className="flex items-center space-x-2">
                          <Checkbox
                            id={event}
                            checked={currentAnalysis.marketEvents?.includes(event) || false}
                            onCheckedChange={() => toggleMarketEvent(event)}
                          />
                          <label
                            htmlFor={event}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {event}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Badge variant="secondary" className="gap-1">
                      <Save className="w-3 h-3" />
                      Auto-saved
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Watchlist Tab */}
        <TabsContent value="weekly" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle>Weekly Gameplan</CardTitle>
                  <CardDescription className="mt-1">
                    Quant-focused weekly analysis: structure, levels, risk parameters, and performance targets
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateWeek('prev')}
                  >
                    ←
                  </Button>
                  <div className="px-3 py-2 rounded-lg border bg-input-background text-sm min-w-[160px] text-center">
                    {formatWeekRange(currentWeekStart)}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateWeek('next')}
                  >
                    →
                  </Button>
                  {weeklyGameplans[currentWeekStart] && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={deleteWeeklyGameplan}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showPreview ? (
                /* Preview Mode */
                <div className="space-y-6">
                  {currentWeekly.watchlist && currentWeekly.watchlist.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2">
                        👀 Watchlist
                      </h4>
                      <div className="space-y-2">
                        {currentWeekly.watchlist.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 rounded-lg border bg-card"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-3">
                                <span className="font-mono">{item.symbol}</span>
                                <Badge variant="outline" className={`border ${getAssetTypeColor(item.assetType)}`}>
                                  {item.assetType}
                                </Badge>
                                {item.setup && (
                                  <Badge variant="secondary">
                                    {item.setup}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {item.notes && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(currentWeekly.weeklyStructure || currentWeekly.weeklyATR || currentWeekly.weeklyRange) && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        📊 Weekly Structure & Metrics
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/50">
                        {currentWeekly.weeklyStructure && (
                          <div>
                            <span className="text-xs text-muted-foreground">Structure:</span>
                            <div className="font-semibold capitalize">{currentWeekly.weeklyStructure}</div>
                          </div>
                        )}
                        {currentWeekly.weeklyVolatility && (
                          <div>
                            <span className="text-xs text-muted-foreground">Volatility:</span>
                            <div className="font-semibold capitalize">{currentWeekly.weeklyVolatility}</div>
                          </div>
                        )}
                        {currentWeekly.weeklyATR && (
                          <div>
                            <span className="text-xs text-muted-foreground">Weekly ATR:</span>
                            <div className="font-mono font-semibold">{currentWeekly.weeklyATR}</div>
                          </div>
                        )}
                        {currentWeekly.weeklyRange && (
                          <div>
                            <span className="text-xs text-muted-foreground">Expected Range:</span>
                            <div className="font-mono font-semibold">{currentWeekly.weeklyRange}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {currentWeekly.weeklyKeyLevels && currentWeekly.weeklyKeyLevels.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2">
                        🎯 Weekly Key Levels
                      </h4>
                      <div className="space-y-2">
                        {currentWeekly.weeklyKeyLevels.map((level) => (
                          <div
                            key={level.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">
                                {getWeeklyLevelTypeLabel(level.type)}
                              </Badge>
                              <span className="font-mono">{level.price}</span>
                              {level.label && (
                                <span className="text-sm text-muted-foreground">• {level.label}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentWeekly.riskParams && (currentWeekly.riskParams.dailyRiskCap || currentWeekly.riskParams.maxPositionSize || currentWeekly.riskParams.twoStrikeRule) && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        🛡️ Risk Parameters
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/50">
                        {currentWeekly.riskParams.dailyRiskCap && (
                          <div>
                            <span className="text-xs text-muted-foreground">Daily Risk Cap:</span>
                            <div className="font-mono font-semibold">${currentWeekly.riskParams.dailyRiskCap}</div>
                          </div>
                        )}
                        {currentWeekly.riskParams.maxPositionSize && (
                          <div>
                            <span className="text-xs text-muted-foreground">Max Position:</span>
                            <div className="font-semibold">{currentWeekly.riskParams.maxPositionSize}</div>
                          </div>
                        )}
                        {currentWeekly.riskParams.maxStopLoss && (
                          <div>
                            <span className="text-xs text-muted-foreground">Max Stop:</span>
                            <div className="font-mono font-semibold">{currentWeekly.riskParams.maxStopLoss} pts</div>
                          </div>
                        )}
                        {currentWeekly.riskParams.maxDailyLoss && (
                          <div>
                            <span className="text-xs text-muted-foreground">Max Daily Loss:</span>
                            <div className="font-mono font-semibold">${currentWeekly.riskParams.maxDailyLoss}</div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentWeekly.riskParams.twoStrikeRule && (
                          <Badge variant="secondary">🛑 2-Strike Rule</Badge>
                        )}
                        {currentWeekly.riskParams.noFirst5Min && (
                          <Badge variant="secondary">🚫 No First 5 Min</Badge>
                        )}
                        {currentWeekly.riskParams.noDataCandle && (
                          <Badge variant="secondary">📅 No Data Candle</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {currentWeekly.performanceTargets && (currentWeekly.performanceTargets.rMultipleGoal || currentWeekly.performanceTargets.winRateGoal) && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        🎯 Performance Targets
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/50">
                        {currentWeekly.performanceTargets.rMultipleGoal && (
                          <div>
                            <span className="text-xs text-muted-foreground">R-Multiple Goal:</span>
                            <div className="font-semibold">{currentWeekly.performanceTargets.rMultipleGoal}</div>
                          </div>
                        )}
                        {currentWeekly.performanceTargets.winRateGoal && (
                          <div>
                            <span className="text-xs text-muted-foreground">Win Rate Goal:</span>
                            <div className="font-semibold">{currentWeekly.performanceTargets.winRateGoal}</div>
                          </div>
                        )}
                        {currentWeekly.performanceTargets.tradesPerDay && (
                          <div>
                            <span className="text-xs text-muted-foreground">Trades/Day:</span>
                            <div className="font-semibold">{currentWeekly.performanceTargets.tradesPerDay}</div>
                          </div>
                        )}
                        {currentWeekly.performanceTargets.weeklyProfitTarget && (
                          <div>
                            <span className="text-xs text-muted-foreground">Profit Target:</span>
                            <div className="font-mono font-semibold">${currentWeekly.performanceTargets.weeklyProfitTarget}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {currentWeekly.weeklyBias && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        📈 Weekly Bias & Strategy
                      </h4>
                      <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap text-sm">
                        {currentWeekly.weeklyBias}
                      </div>
                    </div>
                  )}

                  {currentWeekly.weeklyStrategy && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        📋 Weekly Trading Strategy
                      </h4>
                      <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap text-sm">
                        {currentWeekly.weeklyStrategy}
                      </div>
                    </div>
                  )}

                  {currentWeekly.correlationNotes && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        🔗 Correlation & Market Notes
                      </h4>
                      <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap text-sm">
                        {currentWeekly.correlationNotes}
                      </div>
                    </div>
                  )}

                  {currentWeekly.keyEvents && currentWeekly.keyEvents.length > 0 && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        📅 Key Events This Week
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {currentWeekly.keyEvents.map((event) => (
                          <Badge key={event} variant="secondary">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentWeekly.goals && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2">
                        🎯 Goals & Focus
                      </h4>
                      <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap text-sm">
                        {currentWeekly.goals}
                      </div>
                    </div>
                  )}

                  {!currentWeekly.watchlist?.length && !currentWeekly.weeklyBias && !currentWeekly.keyEvents?.length && !currentWeekly.goals && (
                    <div className="text-center py-8 text-muted-foreground">
                      No gameplan for this week. Switch to Edit mode to add your watchlist.
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Watchlist</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addWatchlistItem}
                        className="gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Symbol
                      </Button>
                    </div>
                    
                    {currentWeekly.watchlist && currentWeekly.watchlist.length > 0 ? (
                      <div className="space-y-3">
                        {currentWeekly.watchlist.map((item) => (
                          <div key={item.id} className="p-4 rounded-lg border bg-card space-y-3">
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                placeholder="Symbol"
                                value={item.symbol}
                                onChange={(e) => updateWatchlistItem(item.id, 'symbol', e.target.value)}
                                className="w-[120px] font-mono"
                              />
                              
                              <Select
                                value={item.assetType}
                                onValueChange={(value) => updateWatchlistItem(item.id, 'assetType', value)}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Futures">Futures</SelectItem>
                                  <SelectItem value="Stock">Stock</SelectItem>
                                  <SelectItem value="Options">Options</SelectItem>
                                  <SelectItem value="Crypto">Crypto</SelectItem>
                                  <SelectItem value="Forex">Forex</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Textarea
                                placeholder="Setup/Strategy"
                                value={item.setup}
                                onChange={(e) => updateWatchlistItem(item.id, 'setup', e.target.value)}
                                className="flex-1 min-h-[40px] resize-y"
                              />
                              
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteWatchlistItem(item.id)}
                                className="text-destructive hover:text-destructive shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            <Textarea
                              placeholder="Notes (optional)"
                              value={item.notes || ''}
                              onChange={(e) => updateWatchlistItem(item.id, 'notes', e.target.value)}
                              className="w-full min-h-[60px] resize-y"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                        Click "Add Symbol" to start building your weekly watchlist
                      </div>
                    )}
                  </div>

                  {/* Weekly Structure & Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Weekly Structure</Label>
                      <Select
                        value={currentWeekly.weeklyStructure || 'neutral'}
                        onValueChange={(value) => updateWeeklyGameplan('weeklyStructure', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bullish">Bullish</SelectItem>
                          <SelectItem value="bearish">Bearish</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="choppy">Choppy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Weekly Volatility</Label>
                      <Select
                        value={currentWeekly.weeklyVolatility || 'normal'}
                        onValueChange={(value) => updateWeeklyGameplan('weeklyVolatility', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="extreme">Extreme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Weekly ATR</Label>
                      <Input
                        type="text"
                        placeholder="e.g., 500"
                        value={currentWeekly.weeklyATR || ''}
                        onChange={(e) => updateWeeklyGameplan('weeklyATR', e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Range</Label>
                      <Input
                        type="text"
                        placeholder="e.g., 20,200-20,700"
                        value={currentWeekly.weeklyRange || ''}
                        onChange={(e) => updateWeeklyGameplan('weeklyRange', e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Weekly Key Levels */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">🎯 Weekly Key Levels</CardTitle>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addWeeklyKeyLevel}
                          className="gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Add Level
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {currentWeekly.weeklyKeyLevels && currentWeekly.weeklyKeyLevels.length > 0 ? (
                        <div className="space-y-2">
                          {currentWeekly.weeklyKeyLevels.map((level) => (
                            <div key={level.id} className="flex gap-2 items-start">
                              <Select
                                value={level.type}
                                onValueChange={(value) => updateWeeklyKeyLevel(level.id, 'type', value)}
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="support">Support</SelectItem>
                                  <SelectItem value="resistance">Resistance</SelectItem>
                                  <SelectItem value="weekly-poc">Weekly POC</SelectItem>
                                  <SelectItem value="weekly-vwap">Weekly VWAP</SelectItem>
                                  <SelectItem value="monthly-level">Monthly Level</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="text"
                                placeholder="Price"
                                value={level.price}
                                onChange={(e) => updateWeeklyKeyLevel(level.id, 'price', e.target.value)}
                                className="w-[120px] font-mono"
                              />
                              <Textarea
                                placeholder="Label (optional)"
                                value={level.label || ''}
                                onChange={(e) => updateWeeklyKeyLevel(level.id, 'label', e.target.value)}
                                className="flex-1 min-h-[40px] resize-y"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteWeeklyKeyLevel(level.id)}
                                className="text-destructive hover:text-destructive shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                          Click "Add Level" to track weekly key levels
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Risk Parameters */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">🛡️ Weekly Risk Parameters</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Daily Risk Cap ($)</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 500"
                            value={currentWeekly.riskParams?.dailyRiskCap || ''}
                            onChange={(e) => updateWeeklyGameplan('riskParams', {
                              ...currentWeekly.riskParams,
                              dailyRiskCap: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max Position Size</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 1 NQ"
                            value={currentWeekly.riskParams?.maxPositionSize || ''}
                            onChange={(e) => updateWeeklyGameplan('riskParams', {
                              ...currentWeekly.riskParams,
                              maxPositionSize: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max Stop Loss (pts)</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 25"
                            value={currentWeekly.riskParams?.maxStopLoss || ''}
                            onChange={(e) => updateWeeklyGameplan('riskParams', {
                              ...currentWeekly.riskParams,
                              maxStopLoss: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max Daily Loss ($)</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 1000"
                            value={currentWeekly.riskParams?.maxDailyLoss || ''}
                            onChange={(e) => updateWeeklyGameplan('riskParams', {
                              ...currentWeekly.riskParams,
                              maxDailyLoss: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="twoStrikeRule"
                            checked={currentWeekly.riskParams?.twoStrikeRule || false}
                            onCheckedChange={(checked) => updateWeeklyGameplan('riskParams', {
                              ...currentWeekly.riskParams,
                              twoStrikeRule: checked as boolean,
                            })}
                          />
                          <label htmlFor="twoStrikeRule" className="text-sm cursor-pointer">
                            🛑 2-Strike Rule
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="noFirst5Min"
                            checked={currentWeekly.riskParams?.noFirst5Min || false}
                            onCheckedChange={(checked) => updateWeeklyGameplan('riskParams', {
                              ...currentWeekly.riskParams,
                              noFirst5Min: checked as boolean,
                            })}
                          />
                          <label htmlFor="noFirst5Min" className="text-sm cursor-pointer">
                            🚫 No First 5 Min
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="noDataCandle"
                            checked={currentWeekly.riskParams?.noDataCandle || false}
                            onCheckedChange={(checked) => updateWeeklyGameplan('riskParams', {
                              ...currentWeekly.riskParams,
                              noDataCandle: checked as boolean,
                            })}
                          />
                          <label htmlFor="noDataCandle" className="text-sm cursor-pointer">
                            📅 No Data Candle
                          </label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Performance Targets */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">🎯 Weekly Performance Targets</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">R-Multiple Goal</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 5R"
                            value={currentWeekly.performanceTargets?.rMultipleGoal || ''}
                            onChange={(e) => updateWeeklyGameplan('performanceTargets', {
                              ...currentWeekly.performanceTargets,
                              rMultipleGoal: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Win Rate Goal (%)</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 60%"
                            value={currentWeekly.performanceTargets?.winRateGoal || ''}
                            onChange={(e) => updateWeeklyGameplan('performanceTargets', {
                              ...currentWeekly.performanceTargets,
                              winRateGoal: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Trades Per Day</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 2-3"
                            value={currentWeekly.performanceTargets?.tradesPerDay || ''}
                            onChange={(e) => updateWeeklyGameplan('performanceTargets', {
                              ...currentWeekly.performanceTargets,
                              tradesPerDay: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Weekly Profit Target ($)</Label>
                          <Input
                            type="text"
                            placeholder="e.g., 2000"
                            value={currentWeekly.performanceTargets?.weeklyProfitTarget || ''}
                            onChange={(e) => updateWeeklyGameplan('performanceTargets', {
                              ...currentWeekly.performanceTargets,
                              weeklyProfitTarget: e.target.value,
                            })}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="weeklyBias">Weekly Bias & Strategy</Label>
                    <Textarea
                      id="weeklyBias"
                      placeholder="What's your outlook for the week? Bull/bear bias, sectors to watch..."
                      value={currentWeekly.weeklyBias}
                      onChange={(e) => updateWeeklyGameplan('weeklyBias', e.target.value)}
                      className="min-h-[100px] resize-y"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weeklyStrategy">Weekly Trading Strategy</Label>
                    <Textarea
                      id="weeklyStrategy"
                      placeholder="Specific strategies, setups to focus on, market conditions to trade..."
                      value={currentWeekly.weeklyStrategy || ''}
                      onChange={(e) => updateWeeklyGameplan('weeklyStrategy', e.target.value)}
                      className="min-h-[100px] resize-y"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="correlationNotes">Correlation & Market Notes</Label>
                    <Textarea
                      id="correlationNotes"
                      placeholder="Correlations with other markets, sector rotation, macro themes..."
                      value={currentWeekly.correlationNotes || ''}
                      onChange={(e) => updateWeeklyGameplan('correlationNotes', e.target.value)}
                      className="min-h-[80px] resize-y"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Key Events This Week</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {availableWeeklyEvents.map((event) => (
                        <div key={event} className="flex items-center space-x-2">
                          <Checkbox
                            id={`weekly-${event}`}
                            checked={currentWeekly.keyEvents?.includes(event) || false}
                            onCheckedChange={() => toggleWeeklyEvent(event)}
                          />
                          <label
                            htmlFor={`weekly-${event}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {event}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goals">Goals & Focus</Label>
                    <Textarea
                      id="goals"
                      placeholder="What do you want to achieve this week? What will you focus on improving?"
                      value={currentWeekly.goals}
                      onChange={(e) => updateWeeklyGameplan('goals', e.target.value)}
                      className="min-h-[100px] resize-y"
                    />
                  </div>

                  <div className="pt-2">
                    <Badge variant="secondary" className="gap-1">
                      <Save className="w-3 h-3" />
                      Auto-saved
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
