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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { signInWithGoogle } = await import('../services/auth');
      await signInWithGoogle();
      if (onSignIn) {
        onSignIn();
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password.');
      setIsLoading(false);
      return;
    }

    try {
      const { signInWithEmail, signUpWithEmail } = await import('../services/auth');
      
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      
      if (onSignIn) {
        onSignIn();
      }
    } catch (error: any) {
      console.error('Authentication failed:', error);
      setError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { resetPassword } = await import('../services/auth');
      await resetPassword(email);
      setError(null);
      alert('Password reset email sent! Please check your inbox.');
    } catch (error: any) {
      console.error('Password reset failed:', error);
      setError(error.message || 'Failed to send password reset email.');
    } finally {
      setIsLoading(false);
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

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  disabled={isLoading}
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    disabled={isLoading}
                    required
                    className="h-11 sm:h-12 pr-10 bg-background/50 border-border/50 focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
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
                    disabled={isLoading}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm cursor-pointer select-none"
                  >
                    Remember me
                  </label>
                </div>
                {!isSignUp && (
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              {/* Email/Password Sign In Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 sm:h-12 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 hover:opacity-90 transition-opacity text-white disabled:opacity-50"
              >
                {isLoading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In Button */}
              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full h-11 sm:h-12 bg-background border border-border hover:bg-accent transition-colors text-foreground flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign In with Google
              </Button>
            </form>

            {/* Sign Up/Sign In Toggle */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline disabled:opacity-50"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  disabled={isLoading}
                >
                  {isSignUp ? 'Sign In' : 'Get Started'}
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
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all group relative ${day.status === 'win'
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
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all group relative ${day.status === 'win'
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
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all group relative ${day.status === 'win'
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
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all group relative ${day.status === 'win'
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

                <style dangerouslySetInnerHTML={{
                  __html: `
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