import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart } from 'recharts';
import { Upload, TrendingUp, TrendingDown, Target, AlertCircle, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { parseDiscordJournal, convertToJournalEntries } from '../services/journalParser';
import { analyzeJournalEntries } from '../services/behavioralAnalysis';
import { JournalEntry } from '../types/journal';
import { toast } from 'sonner';

export function JournalAnalysis() {
  const [journalText, setJournalText] = useState('');
  const [analyzedData, setAnalyzedData] = useState<Awaited<ReturnType<typeof analyzeJournalEntries>> | null>(null);
  const [useGemini, setUseGemini] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;

  const handleAnalyze = async () => {
    if (!journalText.trim()) {
      toast.error('Please paste your journal entries');
      return;
    }

    setIsAnalyzing(true);
    try {
      const parsed = parseDiscordJournal(journalText);
      const entries = convertToJournalEntries(parsed);
      
      // Analyze entries (async now)
      const analysis = await analyzeJournalEntries(entries, useGemini && hasGeminiKey);
      setAnalyzedData(analysis);
      
      toast.success(
        `Analyzed ${entries.length} journal entries${useGemini && hasGeminiKey ? ' with Gemini AI' : ''}`
      );
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze journal entries');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const strengthColors = ['#22c55e', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'];
  const weaknessColors = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a', '#1c1917', '#0a0a0a', '#000000'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Analysis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paste your Discord journal entries to get behavioral analysis, quant-style visualizations, and weekly plan
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="journal-text">Paste Journal Entries</Label>
            <Textarea
              id="journal-text"
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Paste your trading journal entries here..."
              className="min-h-[300px] font-mono text-sm"
              disabled={isAnalyzing}
            />
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
                Analyzing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Analyze Journal Entries
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
                    <p className={`text-3xl font-bold ${
                      analyzedData.averageProcessScore >= 70 
                        ? 'text-green-600 dark:text-green-500'
                        : analyzedData.averageProcessScore >= 50
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : 'text-red-600 dark:text-red-500'
                    }`}>
                      {analyzedData.averageProcessScore.toFixed(1)}
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
                            value: s.percentage,
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
                          width={120}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip 
                          formatter={(value: number, payload: any) => [
                            `${value.toFixed(1)}% (${payload.count}x)`,
                            'Impact Share'
                          ]}
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {analyzedData.pieChartData.strengths.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={strengthColors[index % strengthColors.length]} />
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
                            value: w.percentage,
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
                          width={120}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip 
                          formatter={(value: number, payload: any) => [
                            `${value.toFixed(1)}% (${payload.count}x)`,
                            'Impact Share'
                          ]}
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {analyzedData.pieChartData.weaknesses.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={weaknessColors[index % weaknessColors.length]} />
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
                      value: analyzedData.pieChartData.strengths.find(s => s.tag === 'patience_confirmation')?.percentage || 0,
                      fullMark: 100
                    },
                    {
                      category: 'Level Thesis',
                      value: analyzedData.pieChartData.strengths.find(s => s.tag === 'level_thesis')?.percentage || 0,
                      fullMark: 100
                    },
                    {
                      category: 'Risk Mgmt',
                      value: analyzedData.pieChartData.strengths.find(s => s.tag === 'hard_stop_respected')?.percentage || 0,
                      fullMark: 100
                    },
                    {
                      category: 'Execution',
                      value: 100 - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'hesitation_missed_entry')?.percentage || 0),
                      fullMark: 100
                    },
                    {
                      category: 'Trade Mgmt',
                      value: 100 - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'premature_breakeven')?.percentage || 0) - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'tight_trailing')?.percentage || 0),
                      fullMark: 100
                    },
                    {
                      category: 'Discipline',
                      value: 100 - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'chasing_early_entry')?.percentage || 0) - (analyzedData.pieChartData.weaknesses.find(w => w.tag === 'overtrading')?.percentage || 0),
                      fullMark: 100
                    }
                  ]}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Behavioral Profile"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
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
                      name: s.tag.replace(/_/g, ' ').substring(0, 15),
                      value: s.percentage * 0.5
                    })),
                    ...analyzedData.pieChartData.weaknesses.slice(0, 5).map(w => ({
                      name: w.tag.replace(/_/g, ' ').substring(0, 15),
                      value: -w.percentage * 0.8
                    }))
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}`} />
                  <Tooltip formatter={(value: number) => [`${value > 0 ? '+' : ''}${value.toFixed(1)} pts`, 'Score Impact']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {[
                      { name: 'Base' },
                      ...analyzedData.pieChartData.strengths.slice(0, 5),
                      ...analyzedData.pieChartData.weaknesses.slice(0, 5)
                    ].map((item, index) => (
                      <Cell 
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

          {/* Process Score Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Process Score Trend</CardTitle>
              <p className="text-sm text-muted-foreground">Daily process score evolution</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyzedData.entries
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map(entry => ({
                    date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    score: entry.processScore || 0
                  }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}`, 'Process Score']} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {analyzedData.entries.map((entry, index) => (
                      <Cell 
                        key={index} 
                        fill={
                          (entry.processScore || 0) >= 70 ? '#22c55e' :
                          (entry.processScore || 0) >= 50 ? '#eab308' : '#ef4444'
                        } 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

