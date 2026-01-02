import { TrendingUp, Moon, Sun, BarChart3, FolderOpen, Zap, CheckCircle2, Camera, Calculator, Filter, Copy, Target, Brain, Shield, Rocket, ArrowRight, AlertCircle, FileQuestion, TrendingDown, Twitter, Github, Linkedin } from 'lucide-react';

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
        
        {/* Hero Section */}
        <div className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950/20 dark:via-cyan-950/20 dark:to-teal-950/20 -z-10" />
          
          {/* Navigation */}
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 p-2 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">TradeJournal Pro</span>
              </div>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
            <div className="text-center">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl tracking-tight mb-6">
                Turn Trading Data Into
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">Trading Mastery</span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-12">
                The professional trading journal built for prop firm traders who want to track performance, 
                identify patterns, and consistently improve their results.
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

        {/* Solution Section */}
        <div id="solution" className="py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl sm:text-5xl mb-6">
                  A Professional Trading Journal
                  <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">That Actually Works</span>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
                  TradeJournal Pro is built specifically for prop firm traders who need to track 
                  multiple accounts, analyze performance, and maintain discipline across all their trading.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      icon: CheckCircle2,
                      title: "Log Trades in Seconds",
                      description: "Quick entry form with smart defaults. Track stocks, futures, options, crypto, and forex."
                    },
                    {
                      icon: BarChart3,
                      title: "Visual Analytics",
                      description: "See your performance at a glance with charts, win rates, and P&L tracking."
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

              <div className="bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 p-8 rounded-2xl shadow-2xl">
                <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg">Dashboard</h3>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-green-50 via-cyan-50 to-teal-50 dark:from-green-900/20 dark:via-cyan-900/20 dark:to-teal-900/20 p-4 rounded-lg border-l-4 border-gradient-to-b from-blue-600 via-cyan-500 to-teal-500">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total P&L</div>
                      <div className="text-2xl text-green-600 dark:text-green-500">+$12,450</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Win Rate</div>
                        <div className="text-xl">68%</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trades</div>
                        <div className="text-xl">247</div>
                      </div>
                    </div>

                    <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-end justify-around p-4">
                      <div className="w-8 bg-gradient-to-t from-blue-600 via-cyan-500 to-teal-500 rounded-t" style={{ height: '60%' }}></div>
                      <div className="w-8 bg-gradient-to-t from-blue-600 via-cyan-500 to-teal-500 rounded-t" style={{ height: '80%' }}></div>
                      <div className="w-8 bg-gradient-to-t from-blue-600 via-cyan-500 to-teal-500 rounded-t" style={{ height: '45%' }}></div>
                      <div className="w-8 bg-gradient-to-t from-blue-600 via-cyan-500 to-teal-500 rounded-t" style={{ height: '90%' }}></div>
                      <div className="w-8 bg-gradient-to-t from-blue-600 via-cyan-500 to-teal-500 rounded-t" style={{ height: '70%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                  icon: Calculator,
                  title: "Automatic P&L Calculation",
                  description: "Enter your entry and exit prices, and we calculate profit/loss automatically including futures contract multipliers."
                },
                {
                  icon: Filter,
                  title: "Advanced Filtering & Sorting",
                  description: "Filter trades by date, symbol, asset type, or account. Sort by any column to find patterns quickly."
                },
                {
                  icon: Camera,
                  title: "Screenshot Attachments",
                  description: "Attach trade screenshots to remember your setup. Visual context helps you learn from winners and losers."
                },
                {
                  icon: Target,
                  title: "Risk/Reward Tracking",
                  description: "Set and monitor your risk-reward ratios to ensure you're taking smart, calculated trades."
                },
                {
                  icon: Copy,
                  title: "Copy to All Accounts",
                  description: "Running the same strategy across multiple prop firms? Duplicate any trade to all accounts instantly."
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
