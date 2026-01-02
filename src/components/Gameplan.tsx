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
  type: 'support' | 'resistance' | 'poc' | 'vwap' | 'pivot' | 'other';
  price: string;
  label?: string;
}

interface DailyAnalysis {
  date: string;
  keyLevels: KeyLevel[];
  marketEvents: string[];
  biasDirection: 'bullish' | 'bearish' | 'neutral';
  tradingPlan: string;
}

interface WatchlistItem {
  id: string;
  symbol: string;
  assetType: 'Futures' | 'Stock' | 'Options' | 'Crypto' | 'Forex';
  setup: string;
  notes?: string;
}

interface WeeklyGameplan {
  weekStartDate: string;
  watchlist: WatchlistItem[];
  weeklyBias: string;
  keyEvents: string[];
  goals: string;
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

  const currentAnalysis = dailyAnalyses[selectedAnalysisDate] || {
    date: selectedAnalysisDate,
    keyLevels: [] as KeyLevel[],
    marketEvents: [] as string[],
    biasDirection: 'neutral' as const,
    tradingPlan: '',
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
  const updateDailyAnalysis = (field: keyof DailyAnalysis, value: string | string[] | KeyLevel[]) => {
    setDailyAnalyses(prev => ({
      ...prev,
      [selectedAnalysisDate]: {
        ...currentAnalysis,
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
            Gameplan
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Plan your trades and track your market analysis
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
                  <CardTitle>Daily/Premarket Analysis</CardTitle>
                  <CardDescription className="mt-1">
                    Plan your day and review your performance
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
              {/* Bias Direction */}
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

                  <div className="space-y-2">
                    <Label htmlFor="tradingPlan">Trading Plan</Label>
                    <Textarea
                      id="tradingPlan"
                      placeholder="What are you watching? Entry/exit strategy, position sizing..."
                      value={currentAnalysis.tradingPlan}
                      onChange={(e) => updateDailyAnalysis('tradingPlan', e.target.value)}
                      className="min-h-[120px] resize-y"
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
                  <CardTitle>Sunday Night Watchlist</CardTitle>
                  <CardDescription className="mt-1">
                    Weekly gameplan and market outlook
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
