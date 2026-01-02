import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function CTA() {
  const handleGetStarted = () => {
    // This would trigger OAuth flow in production
    alert('This would redirect to OAuth login (Google, GitHub, etc.)');
  };

  return (
    <div className="py-20 sm:py-32 bg-gradient-to-br from-blue-600 to-indigo-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl text-white mb-6">
          Start Trading Smarter Today
        </h2>
        <p className="text-xl text-blue-100 mb-8">
          Join thousands of prop traders who use TradeJournal Pro to track, analyze, and improve their performance.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <button
            onClick={handleGetStarted}
            className="px-8 py-4 bg-white hover:bg-gray-100 text-blue-600 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 justify-center text-white">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>Free forever plan</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>Sign in with Google/GitHub</span>
          </div>
        </div>

        <p className="mt-8 text-blue-200 text-sm">
          Your trading data stays private and secure. We use OAuth authentication 
          so we never see your password.
        </p>
      </div>
    </div>
  );
}
