import { Target, Brain, Shield, Rocket } from 'lucide-react';

export function Outcomes() {
  const outcomes = [
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
  ];

  return (
    <div className="py-20 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl mb-6">
            Transform Your Trading
            <span className="block text-blue-600 dark:text-blue-500">Results</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            The best traders journal their trades. Here's what happens when you do it right.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {outcomes.map((outcome, index) => (
            <div
              key={index}
              className="flex gap-6 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800"
            >
              <div className="bg-blue-600 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <outcome.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl mb-3">{outcome.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{outcome.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social Proof */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-8">
            <h3 className="text-2xl mb-4">What Traders Are Saying</h3>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4 italic">
                "Finally passed my FTMO challenge after journaling for 3 months. Saw patterns I never noticed before."
              </p>
              <div>
                <div>Mike R.</div>
                <div className="text-sm text-gray-500">Futures Trader</div>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4 italic">
                "Managing 4 prop accounts used to be chaos. This journal keeps everything clean and organized."
              </p>
              <div>
                <div>Sarah K.</div>
                <div className="text-sm text-gray-500">Options Trader</div>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4 italic">
                "The copy-to-all feature saves me so much time. Same trade across 3 accounts in one click."
              </p>
              <div>
                <div>James L.</div>
                <div className="text-sm text-gray-500">Prop Trader</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
