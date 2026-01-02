import { Camera, Calculator, Filter, Copy, Moon, TrendingUp } from 'lucide-react';

export function Features() {
  const features = [
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
      icon: TrendingUp,
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
  ];

  return (
    <div className="py-20 sm:py-32 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl mb-6">
            Everything You Need to
            <span className="block text-blue-600 dark:text-blue-500">Trade Better</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Built by traders, for traders. Every feature serves a purpose.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-600 dark:hover:border-blue-500 transition-colors"
            >
              <div className="bg-blue-100 dark:bg-blue-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-blue-600 dark:text-blue-500" />
              </div>
              <h3 className="text-xl mb-3">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
