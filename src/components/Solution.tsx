import { CheckCircle2, BarChart3, FolderOpen, Zap } from 'lucide-react';

export function Solution() {
  return (
    <div id="solution" className="py-20 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl sm:text-5xl mb-6">
              A Professional Trading Journal
              <span className="block text-blue-600 dark:text-blue-500">That Actually Works</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              TradeJournal Pro is built specifically for prop firm traders who need to track 
              multiple accounts, analyze performance, and maintain discipline across all their trading.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="bg-blue-100 dark:bg-blue-900/20 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg mb-1">Log Trades in Seconds</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Quick entry form with smart defaults. Track stocks, futures, options, crypto, and forex.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-blue-100 dark:bg-blue-900/20 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg mb-1">Visual Analytics</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    See your performance at a glance with charts, win rates, and P&L tracking.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-blue-100 dark:bg-blue-900/20 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg mb-1">Multi-Account Management</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Track TakeProfit Trader, FTMO, and other prop firm accounts separately or together.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-blue-100 dark:bg-blue-900/20 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg mb-1">Copy Trading Feature</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Automatically duplicate trades across all your active accounts with one click.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-8 rounded-2xl shadow-2xl">
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
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-600">
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
                  <div className="w-8 bg-blue-600 rounded-t" style={{ height: '60%' }}></div>
                  <div className="w-8 bg-blue-600 rounded-t" style={{ height: '80%' }}></div>
                  <div className="w-8 bg-blue-600 rounded-t" style={{ height: '45%' }}></div>
                  <div className="w-8 bg-blue-600 rounded-t" style={{ height: '90%' }}></div>
                  <div className="w-8 bg-blue-600 rounded-t" style={{ height: '70%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
