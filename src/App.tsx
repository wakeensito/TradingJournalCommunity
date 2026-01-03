import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dashboard } from './components/Dashboard';
import { TradeEntry } from './components/TradeEntry';
import { TradesList } from './components/TradesList';
import { AccountManager } from './components/AccountManager';
import { Gameplan } from './components/Gameplan';
import { ErrorBoundary } from './components/ErrorBoundary';
import { JournalAnalysis } from './components/JournalAnalysis';
import { FloatingMIA } from './components/FloatingMIA';
import { Trade, Account } from './types/trade';
import { TrendingUp, Menu, X, LogOut, MessageCircle } from 'lucide-react';
import { ThemeToggle } from './components/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import SignIn from './components/SignIn';
import { LandingPage } from './components/LandingPage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const saved = localStorage.getItem('isAuthenticated');
    return saved !== null ? JSON.parse(saved) : false; // Changed back to false for demo
  });

  const [showLanding, setShowLanding] = useState(() => {
    const saved = localStorage.getItem('isAuthenticated');
    return saved !== null ? !JSON.parse(saved) : true; // Show landing if not authenticated
  });

  const [trades, setTrades] = useState<Trade[]>(() => {
    const saved = localStorage.getItem('trades');
    return saved ? JSON.parse(saved) : [];
  });

  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('accounts');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default account - TakeProfit Trader
    return [{
      id: '1',
      name: 'TakeProfit Trader - Main',
      propFirm: 'TakeProfit Trader',
      accountSize: 50000,
      startDate: new Date().toISOString().split('T')[0],
      status: 'active' as const,
      notes: 'Default prop firm account'
    }];
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() => {
    const saved = localStorage.getItem('selectedAccountId');
    return saved || null;
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [isMIADialogOpen, setIsMIADialogOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    // Apply dark mode to document
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('trades', JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem('accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('selectedAccountId', selectedAccountId || '');
  }, [selectedAccountId]);

  useEffect(() => {
    localStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
  }, [isAuthenticated]);

  const addTrade = (trade: Trade) => {
    setTrades([...trades, trade]);
  };

  const updateTrade = (updatedTrade: Trade) => {
    setTrades(trades.map(trade => trade.id === updatedTrade.id ? updatedTrade : trade));
  };

  const deleteTrade = (id: string) => {
    setTrades(trades.filter(trade => trade.id !== id));
  };

  const addAccount = (account: Account) => {
    setAccounts([...accounts, account]);
  };

  const updateAccount = (updatedAccount: Account) => {
    setAccounts(accounts.map(account => account.id === updatedAccount.id ? updatedAccount : account));
  };

  const deleteAccount = (id: string) => {
    setAccounts(accounts.filter(account => account.id !== id));
    // Remove trades associated with this account
    setTrades(trades.filter(trade => trade.accountId !== id));
    // Clear selection if deleted account was selected
    if (selectedAccountId === id) {
      setSelectedAccountId(null);
    }
  };

  const resetAccountPnL = (accountId: string) => {
    // Remove all trades for this account
    setTrades(trades.filter(trade => trade.accountId !== accountId));
  };

  // Calculate stats for a specific account
  const getAccountStats = (accountId: string) => {
    const accountTrades = trades.filter(trade => trade.accountId === accountId);
    const totalPnL = accountTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const tradeCount = accountTrades.length;
    const winningTrades = accountTrades.filter(trade => (trade.pnl || 0) > 0).length;
    const winRate = tradeCount > 0 ? (winningTrades / tradeCount) * 100 : 0;
    
    return { totalPnL, tradeCount, winRate };
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setShowLanding(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowLanding(true);
  };

  const handleGetStarted = () => {
    setShowLanding(false);
  };

  // Filter trades by selected account
  const filteredTrades = selectedAccountId 
    ? trades.filter(trade => trade.accountId === selectedAccountId)
    : trades;

  const activeAccounts = accounts.filter(acc => acc.status === 'active');

  if (showLanding) {
    return (
      <LandingPage 
        onGetStarted={handleGetStarted}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <SignIn 
        onBack={() => setShowLanding(true)}
        isDarkMode={darkMode}
        onThemeToggle={() => setDarkMode(!darkMode)}
        onSignIn={handleLogin}
      />
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <Toaster />
        
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 p-2 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
                    Trading Journal
                  </h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">Track, Analyze, Improve</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Account Filter - Desktop */}
                <div className="hidden md:flex items-center gap-2">
                  <Button
                    variant="default"
                    className="h-9"
                    title="Market Intelligence Assistant"
                    onClick={() => setIsMIADialogOpen(true)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Chat
                  </Button>
                  {activeAccounts.length > 0 && (
                    <Select
                      value={selectedAccountId || 'all'}
                      onValueChange={(value) => setSelectedAccountId(value === 'all' ? null : value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All Accounts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        {activeAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <ThemeToggle isDark={darkMode} onToggle={() => setDarkMode(!darkMode)} />
                
                {/* Logout Button - Desktop */}
                <button
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title="Back to Landing Page"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
                
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Mobile Account Filter */}
            {menuOpen && (
              <div className="md:hidden mt-4 pt-4 border-t border-border">
                {activeAccounts.length > 0 && (
                  <div className="mb-4">
                    <label className="text-sm text-muted-foreground mb-2 block">Filter by Account</label>
                    <Select
                      value={selectedAccountId || 'all'}
                      onValueChange={(value) => setSelectedAccountId(value === 'all' ? null : value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Accounts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        {activeAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Back to Landing
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <Tabs defaultValue="dashboard" className="space-y-6">
            <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="inline-flex w-full min-w-full sm:grid sm:grid-cols-6 gap-1">
                <TabsTrigger value="dashboard" className="text-xs sm:text-sm flex-shrink-0">Dashboard</TabsTrigger>
                <TabsTrigger value="gameplan" className="text-xs sm:text-sm flex-shrink-0">Gameplan</TabsTrigger>
                <TabsTrigger value="accounts" className="text-xs sm:text-sm flex-shrink-0">Accounts</TabsTrigger>
                <TabsTrigger value="entry" className="text-xs sm:text-sm flex-shrink-0">New Trade</TabsTrigger>
                <TabsTrigger value="trades" className="text-xs sm:text-sm flex-shrink-0">Trades</TabsTrigger>
                <TabsTrigger value="journal" className="text-xs sm:text-sm flex-shrink-0">Journal</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="space-y-6">
              <Dashboard trades={filteredTrades} />
            </TabsContent>

            <TabsContent value="gameplan">
              <Gameplan />
            </TabsContent>

            <TabsContent value="accounts">
              <AccountManager
                accounts={accounts}
                onAddAccount={(account) => {
                  const newAccount: Account = {
                    ...account,
                    id: Date.now().toString()
                  };
                  addAccount(newAccount);
                }}
                onUpdateAccount={(id, account) => {
                  const existingAccount = accounts.find(acc => acc.id === id);
                  if (existingAccount) {
                    updateAccount({ ...existingAccount, ...account });
                  }
                }}
                selectedAccountId={selectedAccountId}
                onSelectAccount={setSelectedAccountId}
                getAccountStats={getAccountStats}
              />
            </TabsContent>

            <TabsContent value="entry" className="space-y-6">
              <ErrorBoundary>
                <TradeEntry 
                  onAddTrade={addTrade} 
                  accounts={accounts}
                  selectedAccountId={selectedAccountId}
                />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="trades" className="space-y-6">
              <TradesList
                trades={filteredTrades}
                onUpdateTrade={updateTrade}
                onDeleteTrade={deleteTrade}
                accounts={accounts}
              />
            </TabsContent>

            <TabsContent value="journal" className="space-y-6">
              <JournalAnalysis />
            </TabsContent>
          </Tabs>
        </main>

        {/* Floating MIA Window - Like Gemini on Chrome */}
        <FloatingMIA isOpen={isMIADialogOpen} onClose={() => setIsMIADialogOpen(false)} />
      </div>
    </div>
  );
}