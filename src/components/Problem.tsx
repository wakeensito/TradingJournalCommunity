import { AlertCircle, FileQuestion, TrendingDown, Target } from 'lucide-react';

export function Problem() {
  const problems = [
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
  ];

  return (
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
          {problems.map((problem, index) => (
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
  );
}
