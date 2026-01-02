import { TrendingUp, Moon, Sun } from 'lucide-react';

interface HeroProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export function Hero({ darkMode, setDarkMode }: HeroProps) {
  const handleGetStarted = () => {
    // This would trigger OAuth flow in production
    alert('This would redirect to OAuth login (Google, GitHub, etc.)');
  };

  const handleLearnMore = () => {
    document.getElementById('solution')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 -z-10" />
      
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl">TradeJournal Pro</span>
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

      {/* Hero content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl tracking-tight mb-6">
            Turn Trading Data Into
            <span className="block text-blue-600 dark:text-blue-500">Trading Mastery</span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-12">
            The professional trading journal built for prop firm traders who want to track performance, 
            identify patterns, and consistently improve their results.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl w-full sm:w-auto"
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
            No credit card required • Sign in with Google or GitHub
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-2">10,000+</div>
            <div className="text-gray-600 dark:text-gray-400">Active Traders</div>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">$2.5M+</div>
            <div className="text-gray-600 dark:text-gray-400">Tracked P&L</div>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">95%</div>
            <div className="text-gray-600 dark:text-gray-400">Satisfaction Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}
