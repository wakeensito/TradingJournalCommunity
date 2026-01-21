import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell as RechartsCell } from 'recharts';
import { BookOpen, TrendingUp, ChevronRight } from 'lucide-react';
import { analyzeJournalEntries } from '../services/behavioralAnalysis';
import { JournalEntry } from '../types/journal';
import { toast } from 'sonner';
import { loadJournalEntries, saveJournalEntries } from '../services/journalStorage';

interface JournalAnalysisCardProps {
  onNavigateToJournal?: () => void;
}

export function JournalAnalysisCard({ onNavigateToJournal }: JournalAnalysisCardProps = {}) {
  const [savedEntries, setSavedEntries] = useState<JournalEntry[]>([]);
  const [analyzedData, setAnalyzedData] = useState<Awaited<ReturnType<typeof analyzeJournalEntries>> | null>(null);
  const [useGemini] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;

  // Load saved entries from Firebase/localStorage on mount (with delay to prevent crash on login)
  useEffect(() => {
    // Delay loading to prevent crash on initial login
    const timeoutId = setTimeout(() => {
      const loadEntries = async () => {
        try {
          setIsLoading(true);
          const entries = await loadJournalEntries();
          console.log(`Loaded ${entries.length} journal entries from storage`);
          setSavedEntries(entries);
          // Auto-analyze if we have entries (limit to prevent crashes)
          if (entries.length > 0 && entries.length <= 100) {
            try {
              const analysis = await analyzeJournalEntries(entries.slice(0, 100), useGemini && hasGeminiKey);
              setAnalyzedData(analysis);
            } catch (error) {
              console.error('Auto-analysis failed:', error);
            }
          }
        } catch (error) {
          console.error('Failed to load journal entries:', error);
          // Don't show toast on initial load to prevent spam
          if (savedEntries.length === 0) {
            console.warn('Could not load journal entries, starting with empty list');
          }
        } finally {
          setIsLoading(false);
        }
      };
      loadEntries();
    }, 500); // Delay by 500ms to let the app settle after login

    return () => clearTimeout(timeoutId);
  }, []);

  // Save entries to Firebase/localStorage whenever they change (debounced)
  useEffect(() => {
    if (isLoading) return; // Don't save while loading
    
    const timeoutId = setTimeout(() => {
      if (savedEntries.length > 0) {
        saveJournalEntries(savedEntries).catch(error => {
          console.error('Failed to save journal entries:', error);
          toast.error('Failed to save entries to Firebase. Check console for details.');
        });
      }
    }, 1000); // Debounce saves by 1 second

    return () => clearTimeout(timeoutId);
  }, [savedEntries, isLoading]);

  const analyzeSavedEntries = async (entries?: JournalEntry[]) => {
    const entriesToAnalyze = entries || savedEntries;
    if (entriesToAnalyze.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      // Limit analysis to prevent crashes with large datasets
      const entriesToAnalyzeLimited = entriesToAnalyze.slice(0, 100); // Limit to 100 entries for analysis
      const analysis = await analyzeJournalEntries(entriesToAnalyzeLimited, useGemini && hasGeminiKey);
      setAnalyzedData(analysis);
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze entries. The data may be too large.');
      // Set empty analysis to prevent crash
      setAnalyzedData(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const strengthColors = ['#22c55e', '#10b981', '#059669', '#047857'];
  const weaknessColors = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'];

  // Prepare chart data
  const barChartData = useMemo(() => {
    if (!analyzedData || !analyzedData.pieChartData) return [];
    
    const strengths = (analyzedData.pieChartData.strengths || []).slice(0, 5).map((s, i) => ({
      name: s.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: Math.round(s.percentage * 100) / 100,
      type: 'strength',
      color: strengthColors[i % strengthColors.length]
    }));
    
    const weaknesses = (analyzedData.pieChartData.weaknesses || []).slice(0, 5).map((w, i) => ({
      name: w.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: Math.round(w.percentage * 100) / 100,
      type: 'weakness',
      color: weaknessColors[i % weaknessColors.length]
    }));
    
    return [...strengths, ...weaknesses].sort((a, b) => b.value - a.value);
  }, [analyzedData]);

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
                    {Math.round(analyzedData.averageProcessScore)}/100
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
                        height={80}
                        tick={{ fontSize: 9 }}
                        tickFormatter={(value) => {
                          // Truncate long labels
                          const maxLength = 12;
                          return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                        }}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${Math.round(value * 100) / 100}%`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${Math.round(value * 100) / 100}%`, 'Percentage']}
                      />
                      <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
                        {barChartData.map((entry, index) => (
                          <RechartsCell key={`cell-${index}`} fill={entry.color} />
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
          <Button 
            variant="outline" 
            className="w-full" 
            size="sm"
            onClick={() => {
              if (onNavigateToJournal) {
                onNavigateToJournal();
              }
            }}
          >
            {savedEntries.length > 0 ? 'Add Entry / View Full Analysis' : 'Add Journal Entry'}
            <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
        </CardContent>
      </Card>
    </>
  );
}

