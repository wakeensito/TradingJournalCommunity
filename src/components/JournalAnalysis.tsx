import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { PieChart, Pie, Cell as RechartsCell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart } from 'recharts';
import { Upload, TrendingUp, TrendingDown, Target, AlertCircle, CheckCircle2, Sparkles, Loader2, FileText, Calendar, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { parseDiscordJournal, convertToJournalEntries } from '../services/journalParser';
import { analyzeJournalEntries } from '../services/behavioralAnalysis';
import { JournalEntry } from '../types/journal';
import { toast } from 'sonner';
import { JOURNAL_TEMPLATES, formatTemplate, JournalTemplate } from '../services/journalTemplates';
import { loadJournalEntries, saveJournalEntries, deleteJournalEntry } from '../services/journalStorage';
import { ScrollArea } from './ui/scroll-area';
import { LineChart, Line } from 'recharts';

export function JournalAnalysis() {
  const [journalText, setJournalText] = useState('');
  const [savedEntries, setSavedEntries] = useState<JournalEntry[]>([]);
  const [analyzedData, setAnalyzedData] = useState<Awaited<ReturnType<typeof analyzeJournalEntries>> | null>(null);
  const [useGemini, setUseGemini] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [activeJournalTab, setActiveJournalTab] = useState('entry');

  const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;

  // Load saved entries on mount
  useEffect(() => {
    const loadEntries = async () => {
      try {
        setIsLoading(true);
        const entries = await loadJournalEntries();
        console.log(`Loaded ${entries.length} journal entries from storage`);
        setSavedEntries(entries);
        
        // Auto-analyze if we have entries (limit to prevent crashes)
        if (entries.length > 0 && entries.length <= 100) {
          try {
            const analysis = await analyzeJournalEntries(entries, useGemini && hasGeminiKey);
            setAnalyzedData(analysis);
          } catch (error) {
            console.error('Auto-analysis failed:', error);
          }
        }
      } catch (error) {
        console.error('Failed to load journal entries:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEntries();
  }, []);

  // Re-analyze when Gemini toggle changes
  useEffect(() => {
    if (savedEntries.length > 0 && savedEntries.length <= 100) {
      const analyzeEntries = async () => {
        try {
          const analysis = await analyzeJournalEntries(savedEntries, useGemini && hasGeminiKey);
          setAnalyzedData(analysis);
        } catch (error) {
          console.error('Re-analysis failed:', error);
        }
      };
      analyzeEntries();
    }
  }, [useGemini]);

  const handleTemplateSelect = (templateId: string) => {
    try {
      if (templateId === 'none') {
        setSelectedTemplate('');
        return;
      }
      const template = JOURNAL_TEMPLATES?.find(t => t.id === templateId);
      if (template) {
        const formatted = formatTemplate(template.template);
        setJournalText(formatted);
        setSelectedTemplate(templateId);
      }
    } catch (error) {
      console.error('Error selecting template:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!journalText.trim()) {
      toast.error('Please enter your journal entry');
      return;
    }

    setIsAnalyzing(true);
    try {
      const parsed = parseDiscordJournal(journalText);
      const entries = convertToJournalEntries(parsed);

      // Load existing entries from Firebase (or localStorage fallback)
      let allEntries: JournalEntry[] = [];
      try {
        allEntries = await loadJournalEntries();
      } catch (error) {
        console.error('Failed to load saved entries:', error);
        toast.error('Failed to load existing entries');
      }

      // Add new entries
      const updatedEntries = [...allEntries, ...entries];
      setSavedEntries(updatedEntries);

      // Save to Firebase (or localStorage fallback)
      try {
        await saveJournalEntries(updatedEntries);
        console.log(`Successfully saved ${updatedEntries.length} entries to Firebase`);
      } catch (error: any) {
        console.error('Failed to save entries:', error);
        const errorMessage = error?.message || 'Unknown error';
        toast.error(`Failed to save entries: ${errorMessage}. Check console for details.`);
        // Still continue to analyze even if save failed
      }

      // Analyze all entries (limit to prevent crashes with large datasets)
      try {
        const entriesToAnalyze = updatedEntries.slice(0, 100); // Limit to 100 entries for analysis
        const analysis = await analyzeJournalEntries(entriesToAnalyze, useGemini && hasGeminiKey);
      setAnalyzedData(analysis);
      } catch (error) {
        console.error('Analysis error:', error);
        toast.error('Analysis failed, but entries were saved.');
        setAnalyzedData(null);
      }

      // Clear input and template selection
      setJournalText('');
      setSelectedTemplate('');

      toast.success(
        `Saved and analyzed ${entries.length} journal ${entries.length === 1 ? 'entry' : 'entries'}${useGemini && hasGeminiKey ? ' with Gemini AI' : ''}`
      );
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze journal entries');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleExpand = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      // Delete from Firebase/localStorage
      await deleteJournalEntry(id);
      
      // Update local state
      const updated = savedEntries.filter(e => e.id !== id);
      setSavedEntries(updated);
      
      // Remove from expanded and selected if they were selected
      const newExpanded = new Set(expandedEntries);
      newExpanded.delete(id);
      setExpandedEntries(newExpanded);
      
      const newSelected = new Set(selectedEntries);
      newSelected.delete(id);
      setSelectedEntries(newSelected);
      
      // Re-analyze if entries remain
      if (updated.length > 0) {
        try {
          const entriesToAnalyze = updated.slice(0, 100);
          const analysis = await analyzeJournalEntries(entriesToAnalyze, useGemini && hasGeminiKey);
          setAnalyzedData(analysis);
        } catch (error) {
          console.error('Re-analysis after delete failed:', error);
        }
      } else {
        setAnalyzedData(null);
      }
      
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEntries.size === 0) {
      toast.error('No entries selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedEntries.size} ${selectedEntries.size === 1 ? 'entry' : 'entries'}?`)) {
      return;
    }

    try {
      // Delete all selected entries
      await Promise.all(
        Array.from(selectedEntries).map(id => deleteJournalEntry(id))
      );
      
      const updated = savedEntries.filter(e => !selectedEntries.has(e.id));
      const deletedCount = selectedEntries.size;
      setSavedEntries(updated);
      setSelectedEntries(new Set());
      
      // Remove from expanded
      const newExpanded = new Set(expandedEntries);
      selectedEntries.forEach(id => newExpanded.delete(id));
      setExpandedEntries(newExpanded);
      
      toast.success(`Deleted ${deletedCount} ${deletedCount === 1 ? 'entry' : 'entries'}`);
      
      // Re-analyze if entries remain
      if (updated.length > 0) {
        try {
          const entriesToAnalyze = updated.slice(0, 100);
          const analysis = await analyzeJournalEntries(entriesToAnalyze, useGemini && hasGeminiKey);
          setAnalyzedData(analysis);
        } catch (error) {
          console.error('Re-analysis after delete failed:', error);
        }
      } else {
        setAnalyzedData(null);
      }
    } catch (error) {
      console.error('Failed to delete entries:', error);
      toast.error('Failed to delete entries');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const filtered = getFilteredEntries();
    if (selectedEntries.size === filtered.length && filtered.every(e => selectedEntries.has(e.id))) {
      // Deselect all filtered entries
      setSelectedEntries(prev => {
        const newSet = new Set(prev);
        filtered.forEach(e => newSet.delete(e.id));
        return newSet;
      });
    } else {
      // Select all filtered entries
      setSelectedEntries(prev => {
        const newSet = new Set(prev);
        filtered.forEach(e => newSet.add(e.id));
        return newSet;
      });
    }
  };

  // Group entries by month/year
  const getDateGroups = () => {
    const groups: Record<string, JournalEntry[]> = {};
    savedEntries.forEach(entry => {
      const date = new Date(entry.date);
      const key = `${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });
    return groups;
  };

  // Get filtered entries based on date filter
  const getFilteredEntries = () => {
    if (selectedDateFilter === 'all') {
      return savedEntries;
    }
    const groups = getDateGroups();
    return groups[selectedDateFilter] || [];
  };

  // Get available date groups for dropdown
  const getAvailableDateGroups = () => {
    const groups = getDateGroups();
    return Object.keys(groups).sort((a, b) => {
      // Parse month/year strings for comparison
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const processScoreData = useMemo(() => {
    if (!analyzedData || !analyzedData.entries || !Array.isArray(analyzedData.entries)) return [];
    
    return analyzedData.entries
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10)
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: entry.processScore || 0
      }));
  }, [analyzedData]);

  const strengthColors = ['#22c55e', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'];
  const weaknessColors = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a', '#1c1917', '#0a0a0a', '#000000'];

  return (
    <div className="space-y-6">
      <Tabs value={activeJournalTab} onValueChange={setActiveJournalTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="entry">Entry & Analysis</TabsTrigger>
          <TabsTrigger value="saved">Saved Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Analysis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Write or paste your journal entries. All entries are automatically saved and analyzed for behavioral patterns, quant-style visualizations, and weekly plans.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="journal-text">Journal Entry</Label>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Template</SelectItem>
                    {JOURNAL_TEMPLATES?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    )) || []}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              id="journal-text"
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Enter your trading journal entry here, or select a template to get started..."
              className="min-h-[300px] font-mono text-sm"
              disabled={isAnalyzing}
            />
            {analyzedData && analyzedData.entries.length > 0 && (
              <p className="text-xs text-muted-foreground">
                💾 {analyzedData.entries.length} saved {analyzedData.entries.length === 1 ? 'entry' : 'entries'} • Your entries are automatically saved
              </p>
            )}
          </div>

          {hasGeminiKey && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Checkbox
                id="use-gemini"
                checked={useGemini}
                onCheckedChange={(checked) => setUseGemini(checked === true)}
                disabled={isAnalyzing}
              />
              <Label
                htmlFor="use-gemini"
                className="text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                Use Gemini AI for enhanced analysis
                <Badge variant="outline" className="ml-1">Recommended</Badge>
              </Label>
            </div>
          )}

          {!hasGeminiKey && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-600 dark:text-yellow-500">
                💡 <strong>Tip:</strong> Add <code className="bg-muted px-1 rounded">VITE_GEMINI_API_KEY</code> to your <code className="bg-muted px-1 rounded">.env</code> file for AI-powered analysis
              </p>
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            className="w-full"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving & Analyzing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Save & Analyze Entry
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {analyzedData && (
        <>
          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Average Process Score</p>
                    <p className={`text-3xl font-bold ${analyzedData.averageProcessScore >= 70
                      ? 'text-green-600 dark:text-green-500'
                      : analyzedData.averageProcessScore >= 50
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : 'text-red-600 dark:text-red-500'
                      }`}>
                      {Math.round(analyzedData.averageProcessScore * 100) / 100}
                    </p>
                  </div>
                  <Target className="h-12 w-12 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Entries</p>
                    <p className="text-3xl font-bold">{analyzedData.entries.length}</p>
                  </div>
                  <TrendingUp className="h-12 w-12 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Top Strength</p>
                    <p className="text-lg font-semibold">
                      {analyzedData.pieChartData.strengths[0]?.tag.replace(/_/g, ' ') || 'N/A'}
                    </p>
                  </div>
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Common Setups Analysis */}
          {analyzedData.quantMetrics && analyzedData.quantMetrics.totalEntries > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Common Setups Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">Most frequently used setups, entry methods, and timeframes</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Setup Types */}
                  {analyzedData.quantMetrics.setupFrequency.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Setup Types</h4>
                      <div className="space-y-2">
                        {analyzedData.quantMetrics.setupFrequency.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="text-sm">{item.setup}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{item.count}x</span>
                              <Badge variant="outline" className="text-xs">
                                {item.percentage}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Entry Methods */}
                  {analyzedData.quantMetrics.entryMethodFrequency.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Entry Methods</h4>
                      <div className="space-y-2">
                        {analyzedData.quantMetrics.entryMethodFrequency.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="text-sm">{item.method.length > 25 ? item.method.substring(0, 25) + '...' : item.method}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{item.count}x</span>
                              <Badge variant="outline" className="text-xs">
                                {item.percentage}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Timeframes */}
                  {analyzedData.quantMetrics.timeframeFrequency.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Timeframes</h4>
                      <div className="space-y-2">
                        {analyzedData.quantMetrics.timeframeFrequency.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="text-sm">{item.timeframe}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{item.count}x</span>
                              <Badge variant="outline" className="text-xs">
                                {item.percentage}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Setup Analysis (AI-Powered) */}
          {analyzedData.entries.some(e => e.setupAnalysis) && (
            <Card>
              <CardHeader>
                <CardTitle>Setup Analysis (AI-Powered)</CardTitle>
                <p className="text-sm text-muted-foreground">AI analysis of your trading setups and entry methods</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyzedData.entries
                    .filter(e => e.setupAnalysis)
                    .slice(-5)
                    .reverse()
                    .map((entry) => (
                      <div key={entry.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        {entry.setupAnalysis && (
                          <div className="space-y-3 text-sm">
                            {entry.setupAnalysis.entryMethod && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Entry Method: </span>
                                <span>{entry.setupAnalysis.entryMethod}</span>
                              </div>
                            )}
                            {entry.setupAnalysis.confirmationSignals && entry.setupAnalysis.confirmationSignals.length > 0 && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Confirmation Signals: </span>
                                <span>{entry.setupAnalysis.confirmationSignals.join(', ')}</span>
                              </div>
                            )}
                            {entry.setupAnalysis.levelTypes && entry.setupAnalysis.levelTypes.length > 0 && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Level Types: </span>
                                <span>{entry.setupAnalysis.levelTypes.join(', ')}</span>
                              </div>
                            )}
                            {entry.setupAnalysis.riskManagement && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Risk Management: </span>
                                <span>{entry.setupAnalysis.riskManagement}</span>
                              </div>
                            )}
                            {entry.setupAnalysis.exitStrategy && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Exit Strategy: </span>
                                <span>{entry.setupAnalysis.exitStrategy}</span>
                              </div>
                            )}
                            {entry.setupAnalysis.improvements && entry.setupAnalysis.improvements.length > 0 && (
                              <div className="pt-2 border-t border-border">
                                <span className="font-semibold text-muted-foreground">Improvements: </span>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {entry.setupAnalysis.improvements.map((imp, idx) => (
                                    <li key={idx} className="text-xs">{imp}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Behavioral Analysis - Quant Style Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Strengths - Horizontal Bar Chart (Quant Standard) */}
            <Card>
              <CardHeader>
                <CardTitle>Strengths Impact Share</CardTitle>
                <p className="text-sm text-muted-foreground">Weighted contribution to overall performance</p>
              </CardHeader>
              <CardContent>
                {analyzedData.pieChartData.strengths.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={analyzedData.pieChartData.strengths
                          .sort((a, b) => b.percentage - a.percentage)
                          .map(s => ({
                            name: s.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                            value: Math.round(s.percentage * 100) / 100,
                            count: s.count
                          }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => {
                            // Truncate long labels and add ellipsis
                            const maxLength = 18;
                            return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                          }}
                        />
                        <Tooltip
                          formatter={(value: number, name: string, props: any) => {
                            const count = props?.payload?.count || 0;
                            return [
                              `${Math.round(value * 100) / 100}% (${count}x)`,
                            'Impact Share'
                            ];
                          }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                            padding: '8px 12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                          }}
                          labelStyle={{
                            color: 'hsl(var(--foreground))',
                            fontWeight: '600',
                            marginBottom: '4px'
                          }}
                          itemStyle={{
                            color: 'hsl(var(--foreground))'
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {analyzedData.pieChartData.strengths.map((_, index) => (
                            <RechartsCell key={`cell-${index}`} fill={strengthColors[index % strengthColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="h-96 flex items-center justify-center text-muted-foreground">
                    No strengths detected
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weaknesses - Horizontal Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Weaknesses Impact Share</CardTitle>
                <p className="text-sm text-muted-foreground">Weighted contribution to performance drag</p>
              </CardHeader>
              <CardContent>
                {analyzedData.pieChartData.weaknesses.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={analyzedData.pieChartData.weaknesses
                          .sort((a, b) => b.percentage - a.percentage)
                          .map(w => ({
                            name: w.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                            value: Math.round(w.percentage * 100) / 100,
                            count: w.count
                          }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => {
                            // Truncate long labels and add ellipsis
                            const maxLength = 18;
                            return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                          }}
                        />
                        <Tooltip
                          formatter={(value: number, name: string, props: any) => {
                            const count = props?.payload?.count || 0;
                            return [
                              `${Math.round(value * 100) / 100}% (${count}x)`,
                            'Impact Share'
                            ];
                          }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                            padding: '8px 12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                          }}
                          labelStyle={{
                            color: 'hsl(var(--foreground))',
                            fontWeight: '600',
                            marginBottom: '4px'
                          }}
                          itemStyle={{
                            color: 'hsl(var(--foreground))'
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {analyzedData.pieChartData.weaknesses.map((_, index) => (
                            <RechartsCell key={`cell-${index}`} fill={weaknessColors[index % weaknessColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="h-96 flex items-center justify-center text-muted-foreground">
                    No weaknesses detected
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Radar Chart - Behavioral Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Behavioral Profile Radar</CardTitle>
              <p className="text-sm text-muted-foreground">Multi-dimensional behavioral analysis</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart
                  data={[
                    {
                      category: 'Patience',
                      value: Math.round((analyzedData.pieChartData.strengths.find(s => s.tag === 'patience_confirmation')?.percentage || 0) * 100) / 100,
                      fullMark: 100
                    },
                    {
                      category: 'Level Thesis',
                      value: Math.round((analyzedData.pieChartData.strengths.find(s => s.tag === 'level_thesis')?.percentage || 0) * 100) / 100,
                      fullMark: 100
                    },
                    {
                      category: 'Risk Mgmt',
                      value: Math.round((analyzedData.pieChartData.strengths.find(s => s.tag === 'hard_stop_respected')?.percentage || 0) * 100) / 100,
                      fullMark: 100
                    },
                    {
                      category: 'Execution',
                      value: Math.round((100 - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'hesitation_missed_entry')?.percentage || 0)) * 100) / 100,
                      fullMark: 100
                    },
                    {
                      category: 'Trade Mgmt',
                      value: Math.round((100 - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'premature_breakeven')?.percentage || 0) - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'tight_trailing')?.percentage || 0)) * 100) / 100,
                      fullMark: 100
                    },
                    {
                      category: 'Discipline',
                      value: Math.round((100 - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'chasing_early_entry')?.percentage || 0) - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'overtrading')?.percentage || 0)) * 100) / 100,
                      fullMark: 100
                    }
                  ]}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Behavioral Profile"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                  <Tooltip 
                    formatter={(value: number) => `${Math.round(value * 100) / 100}%`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                      padding: '8px 12px'
                    }}
                    labelStyle={{
                      color: 'hsl(var(--foreground))',
                      fontWeight: '600',
                      marginBottom: '4px'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Weekly Plan */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Don't Go In Blind - Weekly Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Daily Rules
                  </h4>
                  <ul className="space-y-1 text-sm">
                    <li>💰 Risk Cap: {analyzedData.weeklyPlan.riskCap}</li>
                    <li>🛑 Max Stop: {analyzedData.weeklyPlan.maxStop}</li>
                    <li>📊 Sizing: {analyzedData.weeklyPlan.sizingLadder}</li>
                    {analyzedData.weeklyPlan.twoStrikeRule && (
                      <li>🛑 Walk away after 2 bad trades</li>
                    )}
                    {analyzedData.weeklyPlan.noFirst5Min && (
                      <li>🚫 NO trading first 5-minute candle</li>
                    )}
                    {analyzedData.weeklyPlan.noDataCandle && (
                      <li>📅 NO trading data candle</li>
                    )}
                    {analyzedData.weeklyPlan.retestOnly && (
                      <li>⏳ Only enter on retests (no chasing)</li>
                    )}
                    {analyzedData.weeklyPlan.beAfterStructure && (
                      <li>✅ BE only AFTER structure breaks</li>
                    )}
                    {analyzedData.weeklyPlan.chopFilter && (
                      <li>🌊 Sit out choppy conditions</li>
                    )}
                    {analyzedData.weeklyPlan.biasFlipProtocol && (
                      <li>🔄 Flip bias after 2 losses in same direction</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    Custom Reminders
                  </h4>
                  {analyzedData.weeklyPlan.customReminders.length > 0 ? (
                    <ul className="space-y-2">
                      {analyzedData.weeklyPlan.customReminders.map((reminder, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="mt-1">{reminder}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No specific reminders based on recent patterns</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Process Score Attribution (Waterfall Style) */}
          <Card>
            <CardHeader>
              <CardTitle>Process Score Attribution</CardTitle>
              <p className="text-sm text-muted-foreground">How strengths and weaknesses contribute to your score</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: 'Base', value: 50 },
                    ...analyzedData.pieChartData.strengths.slice(0, 5).map(s => ({
                      name: s.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                      value: Math.round((s.percentage * 0.5) * 100) / 100
                    })),
                    ...analyzedData.pieChartData.weaknesses.slice(0, 5).map(w => ({
                      name: w.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                      value: Math.round((-w.percentage * 0.8) * 100) / 100
                    }))
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120} 
                    tick={{ fontSize: 9 }}
                    tickFormatter={(value) => {
                      // Truncate long labels
                      const maxLength = 12;
                      return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                    }}
                  />
                  <YAxis tickFormatter={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`} />
                  <Tooltip 
                    formatter={(value: number) => [`${value > 0 ? '+' : ''}${Math.round(value * 100) / 100} pts`, 'Score Impact']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                      padding: '8px 12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                    labelStyle={{
                      color: 'hsl(var(--foreground))',
                      fontWeight: '600',
                      marginBottom: '4px'
                    }}
                    itemStyle={{
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {[
                      { name: 'Base' },
                      ...analyzedData.pieChartData.strengths.slice(0, 5),
                      ...analyzedData.pieChartData.weaknesses.slice(0, 5)
                    ].map((item, index) => (
                      <RechartsCell
                        key={index}
                        fill={
                          index === 0 ? '#6b7280' :
                            index <= 5 ? '#22c55e' : '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Process Score Over Time - Line Chart */}
          {processScoreData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Process Score Trend</CardTitle>
              <p className="text-sm text-muted-foreground">Daily process score evolution</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={processScoreData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                        padding: '8px 12px'
                      }}
                      labelStyle={{
                        color: 'hsl(var(--foreground))',
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          )}
        </>
      )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-6">
          {savedEntries.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Saved Entries ({savedEntries.length})</CardTitle>
                    <p className="text-sm text-muted-foreground">Your journal entries are automatically saved and analyzed</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedEntries.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelected}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected ({selectedEntries.size})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Date Filter and Select All */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <div className="flex items-center gap-4">
                    <Select value={selectedDateFilter} onValueChange={setSelectedDateFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Entries</SelectItem>
                        {getAvailableDateGroups().map((group) => (
                          <SelectItem key={group} value={group}>
                            {group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={getFilteredEntries().length > 0 && selectedEntries.size === getFilteredEntries().length}
                        onCheckedChange={handleSelectAll}
                      />
                      <Label htmlFor="select-all" className="text-sm cursor-pointer">
                        Select All ({getFilteredEntries().length})
                      </Label>
                    </div>
                  </div>
                </div>

                <ScrollArea className="h-[calc(100vh-500px)]">
                  <div className="space-y-4">
                    {(() => {
                      const filteredEntries = getFilteredEntries();
                      const groups = selectedDateFilter === 'all' ? getDateGroups() : { [selectedDateFilter]: filteredEntries };
                      const sortedGroups = Object.keys(groups).sort((a, b) => {
                        const dateA = new Date(a);
                        const dateB = new Date(b);
                        return dateB.getTime() - dateA.getTime();
                      });

                      return sortedGroups.map((groupKey) => {
                        const groupEntries = groups[groupKey]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        const isMonthExpanded = expandedMonths.has(groupKey);

                        return (
                          <div key={groupKey} className="space-y-3">
                            <div 
                              className="flex items-center gap-2 pb-2 border-b cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors -mx-2 px-2"
                              onClick={() => toggleMonth(groupKey)}
                            >
                              {isMonthExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 rotate-180" />
                              )}
                              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                              <h3 className="text-lg font-semibold flex-1">{groupKey}</h3>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {groupEntries.length} {groupEntries.length === 1 ? 'entry' : 'entries'}
                              </Badge>
                            </div>
                            {isMonthExpanded && groupEntries.map((entry) => {
                              const isExpanded = expandedEntries.has(entry.id);
                              const isSelected = selectedEntries.has(entry.id);
                              
                              return (
                                <Card key={entry.id} className={`border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}>
                                  <CardContent className="p-4">
                                    <div className="space-y-3">
                                      {/* Header */}
                                      <div className="flex items-start gap-3">
                                        <Checkbox
                                          id={`select-${entry.id}`}
                                          checked={isSelected}
                                          onCheckedChange={() => handleToggleSelect(entry.id)}
                                          className="mt-1"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="text-sm font-medium">
                                              {new Date(entry.date).toLocaleDateString('en-US', { 
                                                weekday: 'long',
                                                month: 'long', 
                                                day: 'numeric', 
                                                year: 'numeric' 
                                              })}
                                            </span>
                                            {entry.processScore !== undefined && (
                                              <Badge 
                                                variant="outline" 
                                                className={`text-xs shrink-0 ${
                                                  entry.processScore >= 70 ? 'border-green-500 text-green-600' :
                                                  entry.processScore >= 50 ? 'border-yellow-500 text-yellow-600' :
                                                  'border-red-500 text-red-600'
                                                }`}
                                              >
                                                {Math.round(entry.processScore)}/100
                                              </Badge>
                                            )}
                                          </div>
                                          
                                          {/* Preview */}
                                          {!isExpanded && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                              {entry.content.substring(0, 200)}...
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => toggleExpand(entry.id)}
                                            title={isExpanded ? 'Collapse' : 'Expand'}
                                          >
                                            {isExpanded ? (
                                              <ChevronUp className="h-4 w-4" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4" />
                                            )}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => handleDeleteEntry(entry.id)}
                                            title="Delete entry"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Expanded Content */}
                                      {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-border">
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-xs font-semibold text-muted-foreground uppercase">Full Entry</span>
                                            </div>
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                              <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/50 p-4 rounded-lg border overflow-x-auto">
                                                {entry.content}
                                              </pre>
                                            </div>
                                            {entry.processScore !== undefined && (
                                              <div className="mt-3 pt-3 border-t border-border">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs font-semibold text-muted-foreground">Process Score:</span>
                                                  <Badge 
                                                    variant="outline" 
                                                    className={`${
                                                      entry.processScore >= 70 ? 'border-green-500 text-green-600' :
                                                      entry.processScore >= 50 ? 'border-yellow-500 text-yellow-600' :
                                                      'border-red-500 text-red-600'
                                                    }`}
                                                  >
                                                    {Math.round(entry.processScore)}/100
                                                  </Badge>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Saved Entries</h3>
                  <p className="text-sm text-muted-foreground">
                    Your journal entries will appear here once you save them.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

