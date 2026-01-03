import { TrendingUp, Moon, Sun, BarChart3, FolderOpen, Zap, CheckCircle2, Camera, Calculator, Filter, Copy, Target, Brain, Shield, Rocket, ArrowRight, AlertCircle, FileQuestion, TrendingDown, Twitter, Github, Linkedin, Sparkles, BookOpen, LineChart as LineChartIcon, FileSpreadsheet, Activity, DollarSign, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell, AreaChart, Area } from 'recharts';
import { Badge } from './ui/badge';

interface LandingPageProps {
  onGetStarted: () => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export function LandingPage({ onGetStarted, darkMode, setDarkMode }: LandingPageProps) {
  const handleLearnMore = () => {
    document.getElementById('solution')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
        
        {/* Navigation - Fixed (follows on scroll) */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 p-2 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">TradeJournal Pro</span>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={onGetStarted}
                  className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 hover:opacity-90 text-white rounded-lg transition-opacity shadow-md hover:shadow-lg"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </nav>
        
        {/* Spacer for fixed nav */}
        <div className="h-20"></div>
        
        {/* Hero Section */}
        <div className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800 -mt-20">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950/20 dark:via-cyan-950/20 dark:to-teal-950/20 -z-10" />
          
          {/* Hero Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl tracking-tight mb-6 leading-tight">
                Turn Trading Data Into
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent mt-2">Trading Mastery</span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-12">
                The professional quant trading journal with AI-powered behavioral analysis, advanced metrics, 
                and quant-style visualizations built for serious traders.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={onGetStarted}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 hover:opacity-90 text-white rounded-lg transition-opacity shadow-lg hover:shadow-xl w-full sm:w-auto"
                >
                  Get Started Free
                </button>
                <button
                  onClick={handleLearnMore}
                  className="px-8 py-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg border border-gray-300 dark:border-gray-700 transition-colors w-full sm:w-auto"
                >
                  Learn More
                </button>
              </div>

              <p className="mt-6 text-sm text-gray-500 dark:text-gray-500">
                No credit card required • Start tracking trades instantly
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl mb-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">10,000+</div>
                <div className="text-gray-600 dark:text-gray-400">Active Traders</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">$2.5M+</div>
                <div className="text-gray-600 dark:text-gray-400">Tracked P&L</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">95%</div>
                <div className="text-gray-600 dark:text-gray-400">Satisfaction Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Problem Section */}
        <div className="py-20 sm:py-32 bg-gray-50 dark:bg-gray-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl mb-6">
                Trading Without a Journal is Like
                <span className="block text-red-600 dark:text-red-500">Flying Blind</span>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                Most traders fail because they can't see the patterns. They trade on emotion instead of data.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  icon: FileQuestion,
                  title: "Trading in the Dark",
                  description: "You're making trades without a clear record of what worked and what didn't. Spreadsheets are messy and hard to analyze."
                },
                {
                  icon: TrendingDown,
                  title: "Repeating Mistakes",
                  description: "Without proper tracking, you keep making the same costly errors. You can't identify patterns in your losing trades."
                },
                {
                  icon: Target,
                  title: "Missing Prop Firm Goals",
                  description: "Managing multiple prop firm accounts is chaotic. You lose track of which account is performing and when to reset."
                },
                {
                  icon: AlertCircle,
                  title: "No Accountability",
                  description: "There's no system holding you accountable to your trading plan. You need data-driven insights to stay disciplined."
                }
              ].map((problem, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <div className="bg-red-100 dark:bg-red-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                    <problem.icon className="w-6 h-6 text-red-600 dark:text-red-500" />
                  </div>
                  <h3 className="text-xl mb-3">{problem.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{problem.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Journal Analysis Showcase - NEW */}
        <div className="py-20 sm:py-32 bg-white dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 text-white rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                Powered by Gemini AI
              </div>
              <h2 className="text-4xl sm:text-5xl mb-6">
                AI-Powered Behavioral Analysis
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">For Quant Traders</span>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                Transform your trading journal entries into actionable insights with AI-powered behavioral analysis, quant metrics, and professional-grade visualizations.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-cyan-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 p-2 rounded-lg shadow-sm">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold">AI-Powered Detection</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Gemini AI analyzes your journal entries to automatically detect:
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Strengths: Patience, level-based trading, discipline</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Weaknesses: Premature breakeven, chasing, overtrading</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span>Process Score: 0-100 rating of your trading discipline</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-cyan-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 p-2 rounded-lg shadow-sm">
                        <LineChartIcon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold">Quant-Style Visualizations</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Professional charts used by hedge funds and quant firms:
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#2563eb' }}></div>
                        <span>Stacked horizontal bar charts for impact analysis</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#06b6d4' }}></div>
                        <span>Process score trend over time</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#14b8a6' }}></div>
                        <span>Radar charts for multi-dimensional analysis</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-cyan-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 p-2 rounded-lg shadow-sm">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold">Market Intelligence Assistant</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Your AI trading companion powered by Gemini:
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#2563eb' }}></div>
                        <span>Real-time market data and analysis</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#06b6d4' }}></div>
                        <span>Floating, draggable chat interface</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#14b8a6' }}></div>
                        <span>Get instant answers to trading questions</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 p-8 rounded-2xl shadow-2xl">
                <div className="bg-gray-800 dark:bg-gray-900 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
                    <h3 className="text-lg text-white">Journal Analysis Dashboard</h3>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-green-900/50 to-cyan-900/50 p-4 rounded-lg border-l-4 border-green-500">
                      <div className="text-xs text-gray-400 mb-1">Process Score</div>
                      <div className="text-3xl text-green-400 font-bold">78/100</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Top Strength</div>
                        <div className="text-sm text-green-400">Patience</div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Top Weakness</div>
                        <div className="text-sm text-red-400">Premature BE</div>
                      </div>
                    </div>

                    {/* Process Score Trend Chart */}
                    <div className="h-32 bg-gray-700/40 rounded-lg p-3 border border-gray-600/30">
                      <div className="text-xs text-gray-300 mb-2 font-medium">Process Score Trend</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                          { day: 'Mon', score: 65 },
                          { day: 'Tue', score: 72 },
                          { day: 'Wed', score: 68 },
                          { day: 'Thu', score: 75 },
                          { day: 'Fri', score: 78 }
                        ]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
                          <XAxis 
                            dataKey="day" 
                            tick={{ fill: '#D1D5DB', fontSize: 10, fontWeight: 500 }}
                            stroke="#6B7280"
                          />
                          <YAxis 
                            domain={[60, 80]} 
                            tick={{ fill: '#D1D5DB', fontSize: 9 }}
                            stroke="#6B7280"
                            width={30}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#111827', 
                              border: '1px solid #374151', 
                              borderRadius: '6px', 
                              padding: '6px 10px',
                              color: '#F3F4F6'
                            }}
                            labelStyle={{ color: '#D1D5DB', fontSize: '11px', marginBottom: '4px' }}
                            formatter={(value: number) => [`${value}/100`, 'Score']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#10B981" 
                            strokeWidth={3}
                            dot={{ fill: '#10B981', r: 4, strokeWidth: 2, stroke: '#065F46' }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Strengths/Weaknesses Bar Chart */}
                    <div className="h-40 bg-gray-700/40 rounded-lg p-3 border border-gray-600/30">
                      <div className="text-xs text-gray-300 mb-2 font-medium">Top Behaviors Impact Share</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Patience', value: 28, type: 'strength' },
                            { name: 'Level Thesis', value: 22, type: 'strength' },
                            { name: 'Premature BE', value: -18, type: 'weakness' },
                            { name: 'Tight Trail', value: -15, type: 'weakness' }
                          ]}
                          layout="vertical"
                          margin={{ top: 5, right: 45, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
                          <XAxis 
                            type="number" 
                            domain={[-30, 30]} 
                            tick={{ fill: '#D1D5DB', fontSize: 9 }}
                            stroke="#6B7280"
                            label={{ value: '%', position: 'insideRight', fill: '#D1D5DB', fontSize: 9 }}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            tick={{ fill: '#D1D5DB', fontSize: 9, fontWeight: 500 }}
                            width={75}
                            stroke="#6B7280"
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#111827', 
                              border: '1px solid #374151', 
                              borderRadius: '6px', 
                              padding: '8px 12px',
                              color: '#F3F4F6'
                            }}
                            labelStyle={{ color: '#D1D5DB', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}
                            itemStyle={{ color: '#F3F4F6', fontSize: '12px', fontWeight: 600 }}
                            cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                            formatter={(value: number) => [`${Math.abs(value)}%`, 'Impact']}
                          />
                          <Bar 
                            dataKey="value" 
                            radius={[0, 4, 4, 0]}
                            label={{ 
                              position: 'right', 
                              fill: '#F3F4F6', 
                              fontSize: 10, 
                              fontWeight: 600,
                              formatter: (value: number) => `${Math.abs(value)}%`
                            }}
                          >
                            {[
                              { name: 'Patience', value: 28, type: 'strength' },
                              { name: 'Level Thesis', value: 22, type: 'strength' },
                              { name: 'Premature BE', value: -18, type: 'weakness' },
                              { name: 'Tight Trail', value: -15, type: 'weakness' }
                            ].map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.type === 'strength' ? '#10B981' : '#EF4444'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Behavioral Profile Radar Chart */}
                    <div className="h-52 bg-gray-700/40 rounded-lg p-3 border border-gray-600/30">
                      <div className="text-xs text-gray-300 mb-2 font-medium">Behavioral Profile Radar</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <RadarChart
                          data={[
                            { category: 'Patience', value: 88, fullMark: 100 },
                            { category: 'Level Thesis', value: 82, fullMark: 100 },
                            { category: 'Risk Mgmt', value: 75, fullMark: 100 },
                            { category: 'Execution', value: 70, fullMark: 100 },
                            { category: 'Trade Mgmt', value: 72, fullMark: 100 },
                            { category: 'Discipline', value: 78, fullMark: 100 }
                          ]}
                          margin={{ top: 15, right: 15, bottom: 15, left: 15 }}
                        >
                          <PolarGrid stroke="#4B5563" opacity={0.3} />
                          <PolarAngleAxis 
                            dataKey="category" 
                            tick={{ fill: '#D1D5DB', fontSize: 9, fontWeight: 500 }}
                          />
                          <PolarRadiusAxis 
                            angle={90} 
                            domain={[0, 100]} 
                            tick={{ fill: '#9CA3AF', fontSize: 8 }}
                            tickCount={4}
                          />
                          <Radar
                            name="Behavioral Profile"
                            dataKey="value"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.3}
                            strokeWidth={2}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#111827', 
                              border: '1px solid #374151', 
                              borderRadius: '6px', 
                              padding: '6px 10px',
                              color: '#F3F4F6'
                            }}
                            formatter={(value: number) => [`${value}%`, 'Score']}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Solution Section */}
        <div id="solution" className="py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Centered Heading */}
            <div className="text-center mb-12">
              <h2 className="text-4xl sm:text-5xl mb-6 leading-tight">
                A Professional Trading Journal
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">That Actually Works</span>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                TradeJournal Pro is built specifically for prop firm traders who need to track 
                multiple accounts, analyze performance, and maintain discipline across all their trading.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>

                <div className="space-y-4">
                  {[
                    {
                      icon: CheckCircle2,
                      title: "Log Trades in Seconds",
                      description: "Quick entry form with smart defaults. Track stocks, futures, options, crypto, and forex with quant metrics."
                    },
                    {
                      icon: Sparkles,
                      title: "AI Behavioral Analysis",
                      description: "Gemini AI analyzes your journal entries to detect trading behaviors and calculate process scores."
                    },
                    {
                      icon: BarChart3,
                      title: "Quant Visualizations",
                      description: "Professional charts: stacked bars, radar charts, process score trends, and impact share analysis."
                    },
                    {
                      icon: FolderOpen,
                      title: "Multi-Account Management",
                      description: "Track TakeProfit Trader, FTMO, and other prop firm accounts separately or together."
                    },
                    {
                      icon: Zap,
                      title: "Copy Trading Feature",
                      description: "Automatically duplicate trades across all your active accounts with one click."
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="bg-gradient-to-br from-blue-100 via-cyan-100 to-teal-100 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-teal-900/20 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-blue-600 dark:text-cyan-500" />
                      </div>
                      <div>
                        <h3 className="text-lg mb-1">{item.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl">
                <div className="space-y-4">
                  {/* Key Metrics Grid - Matching actual dashboard style */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Total P&L Card */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total P&L</p>
                          <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-500">+$47,832</p>
                        </div>
                        <DollarSign className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>

                    {/* Win Rate Card */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Win Rate</p>
                          <p className="text-xl font-bold tabular-nums">72.3%</p>
                        </div>
                        <Target className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>

                    {/* Avg R:R Ratio Card */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg R:R Ratio</p>
                          <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-500">1:2.47</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">247 trades</p>
                        </div>
                        <TrendingUp className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>

                    {/* Total Trades Card */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Trades</p>
                          <p className="text-xl font-bold tabular-nums">247</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">12 open</Badge>
                            <Badge variant="outline" className="text-xs whitespace-nowrap">235 closed</Badge>
                          </div>
                        </div>
                        <BarChart3 className="h-6 w-6 text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2" />
                      </div>
                    </div>

                    {/* Profit Factor Card */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Profit Factor</p>
                          <p className="text-xl font-bold tabular-nums">2.34</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avg Win: $194</p>
                        </div>
                        <Calendar className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>

                    {/* Expectancy Card */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Expectancy</p>
                          <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-500">$194</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Per trade</p>
                        </div>
                        <Activity className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* Cumulative P&L Chart */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cumulative P&L</p>
                        <LineChartIcon className="h-4 w-4 text-gray-400" />
                      </div>
                      <ResponsiveContainer width="100%" height={120}>
                        <AreaChart
                          data={[
                            { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).getTime(), cumulative: 35000 },
                            { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).getTime(), cumulative: 36500 },
                            { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).getTime(), cumulative: 37200 },
                            { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).getTime(), cumulative: 39800 },
                            { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).getTime(), cumulative: 42500 },
                            { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).getTime(), cumulative: 45200 },
                            { date: new Date().getTime(), cumulative: 47832 },
                          ]}
                          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="colorPnLPreview" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="cumulative"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#colorPnLPreview)"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Journal Analysis Preview */}
                    <div className="bg-gradient-to-r from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-teal-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Process Score</p>
                        <span className="ml-auto text-sm font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">84/100</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                        <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 h-2 rounded-full" style={{ width: '84%' }}></div>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Strong: Patience, Risk Management</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI & Quant Features Section - NEW */}
        {/* Features Section */}
        <div className="py-20 sm:py-32 bg-gray-50 dark:bg-gray-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl mb-6">
                Everything You Need to
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">Trade Better</span>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                Built by traders, for traders. Every feature serves a purpose.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: BookOpen,
                  title: "Journal Entry Templates",
                  description: "Pre-formatted templates for daily journals, trade analysis, weekly reviews, and premarket planning. Optimized for behavioral analysis."
                },
                {
                  icon: Calculator,
                  title: "Automatic P&L Calculation",
                  description: "Enter your entry and exit prices, and we calculate profit/loss automatically including futures contract multipliers (NQ, MNQ, ES, MES)."
                },
                {
                  icon: Filter,
                  title: "Advanced Filtering & Sorting",
                  description: "Filter trades by date, symbol, asset type, strategy, or account. Sort by any column to find patterns quickly."
                },
                {
                  icon: Camera,
                  title: "Screenshot Attachments",
                  description: "Attach trade screenshots to remember your setup. Visual context helps you learn from winners and losers."
                },
                {
                  icon: Target,
                  title: "Risk/Reward & R-Multiple",
                  description: "Set and monitor your risk-reward ratios and R-multiples. Track actual risk amount per trade for precise analysis."
                },
                {
                  icon: Copy,
                  title: "Copy to All Accounts",
                  description: "Running the same strategy across multiple prop firms? Duplicate any trade to all accounts instantly."
                },
                {
                  icon: BarChart3,
                  title: "Quant Dashboard Metrics",
                  description: "Expectancy, Maximum Drawdown, Profit Factor, Average R:R, Trade Distribution Histogram, and Cumulative P&L charts."
                },
                {
                  icon: FileSpreadsheet,
                  title: "Smart CSV Import",
                  description: "Import trades from CSV with automatic contract detection, timestamp parsing, session detection, and quant metric calculation."
                },
                {
                  icon: Moon,
                  title: "Dark Mode",
                  description: "Easy on the eyes during late-night trading sessions with full dark mode support throughout."
                }
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors"
                >
                  <div className="bg-gradient-to-br from-blue-100 via-cyan-100 to-teal-100 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-teal-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-blue-600 dark:text-cyan-500" />
                  </div>
                  <h3 className="text-xl mb-3">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Outcomes Section */}
        <div className="py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl mb-6">
                Transform Your Trading
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">Results</span>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                The best traders journal their trades. Here's what happens when you do it right.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              {[
                {
                  icon: Brain,
                  title: "Develop Pattern Recognition",
                  description: "See which setups consistently win and which ones drain your account. Make data-driven decisions instead of emotional ones."
                },
                {
                  icon: Target,
                  title: "Hit Your Prop Firm Goals",
                  description: "Track progress toward profit targets. Know exactly where you stand with each account and when it's time to reset."
                },
                {
                  icon: Shield,
                  title: "Build Discipline",
                  description: "Accountability through data. When every trade is recorded, you think twice before breaking your rules."
                },
                {
                  icon: Rocket,
                  title: "Scale Your Trading",
                  description: "Confidently manage multiple prop firm accounts knowing your system keeps everything organized and trackable."
                }
              ].map((outcome, index) => (
                <div
                  key={index}
                  className="flex gap-6 p-8 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950/20 dark:via-cyan-950/20 dark:to-teal-950/20 rounded-xl border border-blue-200 dark:border-blue-800"
                >
                  <div className="bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                    <outcome.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl mb-3">{outcome.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{outcome.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700">
              <div className="text-center mb-8">
                <h3 className="text-2xl mb-4">What Traders Are Saying</h3>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    quote: "Finally passed my FTMO challenge after journaling for 3 months. Saw patterns I never noticed before.",
                    name: "Mike R.",
                    role: "Futures Trader"
                  },
                  {
                    quote: "Managing 4 prop accounts used to be chaos. This journal keeps everything clean and organized.",
                    name: "Sarah K.",
                    role: "Options Trader"
                  },
                  {
                    quote: "The copy-to-all feature saves me so much time. Same trade across 3 accounts in one click.",
                    name: "James L.",
                    role: "Prop Trader"
                  }
                ].map((testimonial, index) => (
                  <div key={index} className="text-center">
                    <p className="text-gray-600 dark:text-gray-400 mb-4 italic">
                      "{testimonial.quote}"
                    </p>
                    <div>
                      <div>{testimonial.name}</div>
                      <div className="text-sm text-gray-500">{testimonial.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-20 sm:py-32 bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl sm:text-5xl text-white mb-6">
              Start Trading Smarter Today
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Join thousands of prop traders who use TradeJournal Pro to track, analyze, and improve their performance.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={onGetStarted}
                className="px-8 py-4 bg-white hover:bg-gray-100 text-blue-600 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center text-white">
              {[
                "No credit card required",
                "Free forever plan",
                "Start in 30 seconds"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <p className="mt-8 text-blue-200 text-sm">
              Your trading data stays private and secure in your browser's local storage.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-800 py-12 bg-white dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 p-2 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">TradeJournal Pro</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Professional trading journal for prop firm traders.
                </p>
              </div>

              <div>
                <h3 className="mb-4">Product</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500">Features</a></li>
                  <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500">Pricing</a></li>
                  <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500">Roadmap</a></li>
                </ul>
              </div>

              <div>
                <h3 className="mb-4">Resources</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500">Documentation</a></li>
                  <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500">Blog</a></li>
                  <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500">Support</a></li>
                </ul>
              </div>

              <div>
                <h3 className="mb-4">Legal</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500">Privacy Policy</a></li>
                  <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500">Terms of Service</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                © 2026 TradeJournal Pro. All rights reserved.
              </p>
              
              <div className="flex gap-4">
                <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500" aria-label="Twitter">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500" aria-label="GitHub">
                  <Github className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-500" aria-label="LinkedIn">
                  <Linkedin className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
