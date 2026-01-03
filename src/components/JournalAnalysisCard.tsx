import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Line, LineChart } from 'recharts';
import { Sparkles, Loader2, BookOpen, TrendingUp, Target, Calendar, ChevronRight, FileText } from 'lucide-react';
import { parseDiscordJournal, convertToJournalEntries } from '../services/journalParser';
import { analyzeJournalEntries } from '../services/behavioralAnalysis';
import { JournalEntry } from '../types/journal';
import { toast } from 'sonner';
import { JOURNAL_TEMPLATES, formatTemplate, JournalTemplate } from '../services/journalTemplates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const STORAGE_KEY = 'tradingJournal_entries';

export function JournalAnalysisCard() {
  const [journalText, setJournalText] = useState('');
  const [savedEntries, setSavedEntries] = useState<JournalEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [analyzedData, setAnalyzedData] = useState<Awaited<ReturnType<typeof analyzeJournalEntries>> | null>(null);
  const [useGemini, setUseGemini] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;

  // Load and analyze saved entries on mount
  useEffect(() => {
    if (savedEntries.length > 0) {
      analyzeSavedEntries();
    }
  }, []);

  // Save entries to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedEntries));
  }, [savedEntries]);

  const analyzeSavedEntries = async () => {
    if (savedEntries.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeJournalEntries(savedEntries, useGemini && hasGeminiKey);
      setAnalyzedData(analysis);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddEntry = async () => {
    if (!journalText.trim()) {
      toast.error('Please paste your journal entries');
      return;
    }

    setIsAnalyzing(true);
    try {
      const parsed = parseDiscordJournal(journalText);
      const newEntries = convertToJournalEntries(parsed);
      
      // Add new entries to saved entries
      const updatedEntries = [...savedEntries, ...newEntries];
      setSavedEntries(updatedEntries);
      
      // Analyze all entries
      const analysis = await analyzeJournalEntries(updatedEntries, useGemini && hasGeminiKey);
      setAnalyzedData(analysis);
      
      // Clear input
      setJournalText('');
      
      toast.success(
        `Added ${newEntries.length} journal entries${useGemini && hasGeminiKey ? ' with Gemini AI' : ''}`
      );
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze journal entries');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteEntry = (id: string) => {
    const updated = savedEntries.filter(e => e.id !== id);
    setSavedEntries(updated);
    if (updated.length > 0) {
      analyzeJournalEntries(updated, useGemini && hasGeminiKey).then(setAnalyzedData);
    } else {
      setAnalyzedData(null);
    }
    toast.success('Journal entry deleted');
  };

  // Re-analyze when Gemini toggle changes
  useEffect(() => {
    if (savedEntries.length > 0) {
      analyzeSavedEntries();
    }
  }, [useGemini]);

  const strengthColors = ['#22c55e', '#10b981', '#059669', '#047857'];
  const weaknessColors = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'];

  // Prepare chart data
  const barChartData = useMemo(() => {
    if (!analyzedData) return [];
    
    const strengths = analyzedData.pieChartData.strengths.slice(0, 5).map((s, i) => ({
      name: s.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: s.percentage,
      type: 'strength',
      color: strengthColors[i % strengthColors.length]
    }));
    
    const weaknesses = analyzedData.pieChartData.weaknesses.slice(0, 5).map((w, i) => ({
      name: w.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: w.percentage,
      type: 'weakness',
      color: weaknessColors[i % weaknessColors.length]
    }));
    
    return [...strengths, ...weaknesses].sort((a, b) => b.value - a.value);
  }, [analyzedData]);

  const processScoreData = useMemo(() => {
    if (!analyzedData) return [];
    
    return analyzedData.entries
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10)
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: entry.processScore || 0
      }));
  }, [analyzedData]);

  return (
    <>
      <Card className="hover-glow group">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Journal Analysis</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {savedEntries.length} entries
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {analyzedData ? (
            <>
              {/* Process Score */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Average Process Score</p>
                  <p className={`text-2xl font-bold ${analyzedData.averageProcessScore >= 70 ? 'text-green-600' : analyzedData.averageProcessScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {analyzedData.averageProcessScore}/100
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>

              {/* Mini Chart */}
              {barChartData.length > 0 && (
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                  <p className="text-muted-foreground">Top Strength</p>
                  <p className="font-semibold text-green-600">
                    {analyzedData.pieChartData.strengths[0]?.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                  </p>
                </div>
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                  <p className="text-muted-foreground">Top Weakness</p>
                  <p className="font-semibold text-red-600">
                    {analyzedData.pieChartData.weaknesses[0]?.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No journal entries yet</p>
              <p className="text-xs mt-1">Add entries to see behavioral analysis</p>
            </div>
          )}

          {/* Actions */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full" size="sm">
                {savedEntries.length > 0 ? 'Add Entry / View Full Analysis' : 'Add Journal Entry'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Journal Entry Analysis</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Add Entry Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Add New Entry</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Template Selector */}
                    <div className="space-y-2">
                      <Label htmlFor="template-select">Use Template (Optional)</Label>
                      <Select
                        onValueChange={(value) => {
                          const template = JOURNAL_TEMPLATES.find(t => t.id === value);
                          if (template) {
                            setJournalText(formatTemplate(template.template));
                            toast.success(`Loaded ${template.name} template`);
                          }
                        }}
                      >
                        <SelectTrigger id="template-select">
                          <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Choose a template...</SelectItem>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Daily</div>
                          {JOURNAL_TEMPLATES.filter(t => t.category === 'daily').map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex flex-col">
                                <span>{template.name}</span>
                                <span className="text-xs text-muted-foreground">{template.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Trade Analysis</div>
                          {JOURNAL_TEMPLATES.filter(t => t.category === 'trade').map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex flex-col">
                                <span>{template.name}</span>
                                <span className="text-xs text-muted-foreground">{template.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Other</div>
                          {JOURNAL_TEMPLATES.filter(t => t.category === 'weekly' || t.category === 'quick').map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex flex-col">
                                <span>{template.name}</span>
                                <span className="text-xs text-muted-foreground">{template.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="journal-text">Paste Journal Entry</Label>
                      <Textarea
                        id="journal-text"
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                        placeholder="Paste your trading journal entry here (Discord format) or use a template above..."
                        className="min-h-[300px] font-mono text-sm"
                        disabled={isAnalyzing}
                      />
                    </div>
                    
                    {hasGeminiKey && (
                      <div className="flex items-center space-x-2 p-2 rounded-lg bg-muted/50 border border-border">
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
                        </Label>
                      </div>
                    )}
                    
                    <Button 
                      onClick={handleAddEntry} 
                      disabled={isAnalyzing || !journalText.trim()}
                      className="w-full"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        'Add & Analyze Entry'
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Saved Entries List */}
                {savedEntries.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Saved Entries ({savedEntries.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        <div className="space-y-2">
                          {savedEntries
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((entry) => (
                              <div key={entry.id} className="flex items-start justify-between p-3 rounded-lg border bg-card">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs font-medium">
                                      {new Date(entry.date).toLocaleDateString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric', 
                                        year: 'numeric' 
                                      })}
                                    </span>
                                    {entry.processScore !== undefined && (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${
                                          entry.processScore >= 70 ? 'border-green-500 text-green-600' :
                                          entry.processScore >= 50 ? 'border-yellow-500 text-yellow-600' :
                                          'border-red-500 text-red-600'
                                        }`}
                                      >
                                        {entry.processScore}/100
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {entry.content.substring(0, 150)}...
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 ml-2"
                                  onClick={() => handleDeleteEntry(entry.id)}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {/* Full Analysis View */}
                {analyzedData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Full Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Process Score Trend */}
                      {processScoreData.length > 0 && (
                        <div>
                          <Label className="text-sm mb-2 block">Process Score Trend</Label>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={processScoreData}>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Line 
                                  type="monotone" 
                                  dataKey="score" 
                                  stroke="#8884d8" 
                                  strokeWidth={2}
                                  dot={{ r: 4 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Weekly Plan */}
                      {analyzedData.weeklyPlan && (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Target className="h-4 w-4 text-primary" />
                            <Label className="text-sm font-semibold">Weekly Plan</Label>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Risk Cap: </span>
                              {analyzedData.weeklyPlan.riskCap}
                            </div>
                            <div>
                              <span className="font-medium">Max Stop: </span>
                              {analyzedData.weeklyPlan.maxStop}
                            </div>
                            {analyzedData.weeklyPlan.dailyRules.length > 0 && (
                              <div>
                                <span className="font-medium">Daily Rules:</span>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {analyzedData.weeklyPlan.dailyRules.slice(0, 5).map((rule, i) => (
                                    <li key={i} className="text-xs">{rule}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </>
  );
}

