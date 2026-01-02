import { useState } from 'react';
import { TrendingUp, Eye, EyeOff, ArrowLeft, BarChart3, Calendar, Target } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { ThemeToggle } from './ThemeToggle';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface SignInProps {
  onBack?: () => void;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  onSignIn?: () => void; // Add this prop
}

export default function SignIn({ onBack, isDarkMode = false, onThemeToggle, onSignIn }: SignInProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle sign in logic here
    console.log('Sign in attempt:', { email, password, rememberMe });
    // Call the onSignIn callback to authenticate
    if (onSignIn) {
      onSignIn();
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-background relative overflow-x-hidden">
      {/* Mobile Background - Extends behind status bar */}
      <div className="fixed inset-0 lg:hidden pointer-events-none bg-gradient-to-br from-blue-600/10 via-cyan-500/10 to-teal-500/10 dark:from-blue-600/20 dark:via-cyan-500/20 dark:to-teal-500/20"></div>

      {/* Desktop Background - Split Screen */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-transparent"></div>
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent"></div>
      </div>

      {/* Main Content Area - Mobile with safe areas */}
      <div className="flex-1 flex items-center justify-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:p-8 lg:p-12 relative z-10 lg:pt-12">
        {/* Top Navigation Bar - Mobile/Tablet with safe spacing */}
        <div className="fixed top-[env(safe-area-inset-top)] left-0 right-0 flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 lg:hidden z-20">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-full"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          {onThemeToggle && (
            <div className="bg-card/80 backdrop-blur-sm rounded-full p-1">
              <ThemeToggle isDark={isDarkMode} onToggle={onThemeToggle} />
            </div>
          )}
        </div>

        {/* Desktop Navigation - Back Button & Theme Toggle */}
        <div className="hidden lg:block">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          {onThemeToggle && (
            <div className="absolute top-6 right-6">
              <ThemeToggle isDark={isDarkMode} onToggle={onThemeToggle} />
            </div>
          )}
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md mt-20 mb-8 sm:mt-0 lg:mb-0">
          {/* Mobile Card Wrapper - iOS style with safe spacing */}
          <div className="lg:bg-transparent bg-card/60 lg:backdrop-blur-none backdrop-blur-xl lg:border-0 border border-border/40 rounded-3xl lg:rounded-none p-6 sm:p-8 lg:p-0 shadow-2xl lg:shadow-none">
            {/* Logo & Header */}
            <div className="mb-8 lg:mb-10">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl sm:text-3xl bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
                  Trading Journal
                </h1>
              </div>
              <h2 className="text-2xl sm:text-3xl mb-3">
                Everything you ever <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">wanted to know</span> about your trading...
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Sign in to track your trades, analyze performance, and improve your strategy.
              </p>
            </div>

            {/* Sign In Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="trader@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 sm:h-12 bg-background/50 border-border/50 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 sm:h-12 pr-10 bg-background/50 border-border/50 focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm cursor-pointer select-none"
                  >
                    Remember me
                  </label>
                </div>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => console.log('Forgot password clicked')}
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign In Button */}
              <Button 
                type="submit" 
                className="w-full h-11 sm:h-12 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 hover:opacity-90 transition-opacity text-white"
              >
                Sign In Now
              </Button>
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => console.log('Sign up clicked')}
                >
                  Get Started
                </button>
              </p>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Visual/Preview (Desktop Only) */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Content */}
        <div className="relative z-20 flex flex-col items-center justify-center p-12 text-white">
          {/* Dashboard Preview Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl max-w-lg w-full">
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-5 h-5" />
                    <p className="text-sm opacity-90">Total P&L</p>
                  </div>
                  <p className="text-2xl">$12,458</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5" />
                    <p className="text-sm opacity-90">Win Rate</p>
                  </div>
                  <p className="text-2xl">68.5%</p>
                </div>
              </div>

              {/* Chart Visualization */}
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 border border-white/30">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm opacity-90">7-Day Win Streak</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-75">🔥 5 days</span>
                    <Calendar className="w-4 h-4 opacity-75" />
                  </div>
                </div>
                
                {/* Calendar Grid */}
                <div className="space-y-3">
                  {/* Day Labels */}
                  <div className="grid grid-cols-7 gap-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                      <div key={i} className="text-center text-xs opacity-60">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days - 4 weeks */}
                  <div className="space-y-2">
                    {/* Week 1 */}
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        { status: 'win', profit: '+$450', display: '+450' },
                        { status: 'win', profit: '+$320', display: '+320' },
                        { status: 'loss', profit: '-$180', display: '-180' },
                        { status: 'win', profit: '+$590', display: '+590' },
                        { status: 'none' },
                        { status: 'none' },
                        { status: 'none' },
                      ].map((day, i) => (
                        <div
                          key={i}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all group relative ${
                            day.status === 'win' 
                              ? 'bg-green-500/70 hover:bg-green-500/90 cursor-pointer' 
                              : day.status === 'loss' 
                              ? 'bg-red-500/70 hover:bg-red-500/90 cursor-pointer' 
                              : 'bg-white/10'
                          }`}
                          style={{
                            animation: day.status !== 'none' ? `fadeIn 0.3s ease-out ${i * 0.05}s both` : 'none'
                          }}
                        >
                          {day.status !== 'none' && (
                            <span className="leading-tight">
                              {day.display}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Week 2 */}
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        { status: 'none' },
                        { status: 'none' },
                        { status: 'win', profit: '+$720', display: '+720' },
                        { status: 'win', profit: '+$380', display: '+380' },
                        { status: 'win', profit: '+$510', display: '+510' },
                        { status: 'none' },
                        { status: 'none' },
                      ].map((day, i) => (
                        <div
                          key={i}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all group relative ${
                            day.status === 'win' 
                              ? 'bg-green-500/70 hover:bg-green-500/90 cursor-pointer' 
                              : day.status === 'loss' 
                              ? 'bg-red-500/70 hover:bg-red-500/90 cursor-pointer' 
                              : 'bg-white/10'
                          }`}
                          style={{
                            animation: day.status !== 'none' ? `fadeIn 0.3s ease-out ${(i + 7) * 0.05}s both` : 'none'
                          }}
                        >
                          {day.status !== 'none' && (
                            <span className="leading-tight">
                              {day.display}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Week 3 */}
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        { status: 'none' },
                        { status: 'none' },
                        { status: 'win', profit: '+$640', display: '+640' },
                        { status: 'win', profit: '+$290', display: '+290' },
                        { status: 'loss', profit: '-$220', display: '-220' },
                        { status: 'none' },
                        { status: 'none' },
                      ].map((day, i) => (
                        <div
                          key={i}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all group relative ${
                            day.status === 'win' 
                              ? 'bg-green-500/70 hover:bg-green-500/90 cursor-pointer' 
                              : day.status === 'loss' 
                              ? 'bg-red-500/70 hover:bg-red-500/90 cursor-pointer' 
                              : 'bg-white/10'
                          }`}
                          style={{
                            animation: day.status !== 'none' ? `fadeIn 0.3s ease-out ${(i + 14) * 0.05}s both` : 'none'
                          }}
                        >
                          {day.status !== 'none' && (
                            <span className="leading-tight">
                              {day.display}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Week 4 - Current */}
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        { status: 'none' },
                        { status: 'none' },
                        { status: 'win', profit: '+$880', display: '+880' },
                        { status: 'win', profit: '+$430', display: '+430' },
                        { status: 'win', profit: '+$560', display: '+560' },
                        { status: 'win', profit: '+$710', display: '+710' },
                        { status: 'win', profit: '+$390', display: '+390', current: true },
                      ].map((day, i) => (
                        <div
                          key={i}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all group relative ${
                            day.status === 'win' 
                              ? day.current 
                                ? 'bg-green-500/90 hover:bg-green-500 cursor-pointer ring-2 ring-white/60' 
                                : 'bg-green-500/70 hover:bg-green-500/90 cursor-pointer'
                              : day.status === 'loss' 
                              ? 'bg-red-500/70 hover:bg-red-500/90 cursor-pointer' 
                              : 'bg-white/10'
                          }`}
                          style={{
                            animation: day.status !== 'none' ? `fadeIn 0.3s ease-out ${(i + 21) * 0.05}s both` : 'none'
                          }}
                        >
                          {day.status !== 'none' && (
                            <span className="leading-tight">
                              {day.display}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes fadeIn {
                    from {
                      opacity: 0;
                      transform: scale(0.8);
                    }
                    to {
                      opacity: 1;
                      transform: scale(1);
                    }
                  }
                `}} />
              </div>

              {/* Features List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  <p className="text-sm opacity-90">Advanced analytics and insights</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  <p className="text-sm opacity-90">Track all asset types: Stocks, Futures, Options, Crypto</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  <p className="text-sm opacity-90">Calendar view with trade journaling</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Text */}
          <div className="mt-12 text-center max-w-md">
            <p className="text-lg mb-2">Join thousands of traders</p>
            <p className="text-sm opacity-75">
              Who are already improving their trading performance with data-driven insights
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}