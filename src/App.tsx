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

  const [isAuthenticated, setIsAuthenticated] = useState(false); // Default to false
  const [user, setUser] = useState<any>(null); // Track user object
  const [authChecked, setAuthChecked] = useState(false); // Track if auth state has been checked

  useEffect(() => {
    // Subscribe to auth state changes
    let unsubscribe: (() => void) | null = null;
    
    import('./services/auth').then(({ subscribeToAuthChanges }) => {
      unsubscribe = subscribeToAuthChanges(async (user) => {
        const authenticated = !!user;
        setIsAuthenticated(authenticated);
        setUser(user);
        setAuthChecked(true);
        
        if (authenticated) {
          setShowLanding(false); // Auto-redirect to dashboard if logged in
          
          // Load data from Firebase when user authenticates
          try {
            const { loadTrades, loadAccounts, loadSelectedAccountId, saveTrades, saveAccounts, saveSelectedAccountId } = await import('./services/tradeStorage');
            
            // Load data with individual error handling to prevent one failure from crashing everything
            // Firebase only - no localStorage fallback
            let firebaseTrades: Trade[] = [];
            let firebaseAccounts: Account[] = [];
            let firebaseSelectedAccountId: string | null = null;
            
            try {
              firebaseTrades = await loadTrades();
            } catch (error) {
              console.error('Error loading trades from Firebase:', error);
              // Firebase only - set empty array on error
              firebaseTrades = [];
            }
            
            try {
              firebaseAccounts = await loadAccounts();
            } catch (error) {
              console.error('Error loading accounts from Firebase:', error);
              // Firebase only - return empty array on error (no default account)
              firebaseAccounts = [];
            }
            
            try {
              firebaseSelectedAccountId = await loadSelectedAccountId();
            } catch (error) {
              console.error('Error loading selected account ID from Firebase:', error);
              // Firebase only - set null on error
              firebaseSelectedAccountId = null;
            }
            
            // ALWAYS use Firebase as source of truth when authenticated (Firebase only, no localStorage)
            console.log(`Loading ${firebaseTrades.length} trades from Firebase`);
            setTrades(firebaseTrades);
            
            // ALWAYS use Firebase accounts - no default account creation
            // If user wants a default account, they can create it manually
            setAccounts(firebaseAccounts);
            console.log(`[App] Loaded ${firebaseAccounts.length} account(s) from Firebase`);
            
            // Set selected account ID if it exists and is valid
            if (firebaseSelectedAccountId) {
              // Verify the selected account ID exists in the loaded accounts
              const accountExists = firebaseAccounts.some(acc => acc.id === firebaseSelectedAccountId);
              if (accountExists) {
                setSelectedAccountId(firebaseSelectedAccountId);
                console.log(`[App] Set selected account ID: ${firebaseSelectedAccountId}`);
              } else {
                console.warn(`[App] Selected account ID ${firebaseSelectedAccountId} not found in accounts, clearing selection`);
                setSelectedAccountId(null);
                // Clear invalid selection from Firebase
                if (isAuthenticated && authChecked) {
                  import('./services/tradeStorage').then(({ saveSelectedAccountId }) => {
                    saveSelectedAccountId(null);
                  });
                }
              }
            } else {
              // No selected account ID, set to null
              setSelectedAccountId(null);
            }
          } catch (error) {
            console.error('Error loading data from Firebase:', error);
            // Firebase only - no localStorage fallback
            // Set empty arrays on error (no default accounts)
            setTrades([]);
            setAccounts([]);
            setSelectedAccountId(null);
          }
        } else {
          setShowLanding(true); // Show landing if not authenticated
        }
      });
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const [showLanding, setShowLanding] = useState(true); // Always start with landing page

  const [trades, setTrades] = useState<Trade[]>([]);

  const [accounts, setAccounts] = useState<Account[]>([]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [isMIADialogOpen, setIsMIADialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDeleting, setIsDeleting] = useState(false);

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
    // Skip saving if we're still loading initial data or if we're in the middle of a delete operation
    if (!authChecked || isDeleting || !isAuthenticated) return;
    
    // Firebase only - save to Firebase
    // Use a small delay to debounce rapid changes
    const timeoutId = setTimeout(() => {
      import('./services/tradeStorage').then(({ saveTrades }) => {
        console.log(`[App] useEffect triggered - saving ${trades.length} trades to Firebase`);
        saveTrades(trades).then(() => {
          console.log(`[App] Successfully saved ${trades.length} trades to Firebase`);
        }).catch(error => {
          console.error('[App] Error saving trades to Firebase:', error);
        });
      });
    }, 100); // 100ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [trades, isAuthenticated, authChecked, isDeleting]);

  useEffect(() => {
    if (isAuthenticated && authChecked) {
      // Firebase only - save to Firebase
      import('./services/tradeStorage').then(({ saveAccounts }) => {
        console.log(`[App] useEffect triggered - saving ${accounts.length} accounts to Firebase`);
        saveAccounts(accounts).then(() => {
          console.log(`[App] Successfully saved ${accounts.length} accounts to Firebase`);
        }).catch(error => {
          console.error('[App] Error saving accounts to Firebase:', error);
          console.error('[App] Error details:', {
            code: error?.code,
            message: error?.message
          });
          alert(`Failed to save accounts: ${error?.message || 'Unknown error'}. Check console for details.`);
        });
      });
    }
  }, [accounts, isAuthenticated, authChecked]);

  useEffect(() => {
    if (isAuthenticated && authChecked) {
      // Firebase only - save to Firebase
      import('./services/tradeStorage').then(({ saveSelectedAccountId }) => {
        console.log(`[App] Saving selected account ID: ${selectedAccountId}`);
        saveSelectedAccountId(selectedAccountId).then(() => {
          console.log(`[App] Successfully saved selected account ID to Firebase`);
        }).catch(error => {
          console.error('[App] Error saving selected account ID to Firebase:', error);
          console.error('[App] Error details:', {
            code: error?.code,
            message: error?.message
          });
          alert(`Failed to save selected account: ${error?.message || 'Unknown error'}. Check console for details.`);
        });
      });
    }
  }, [selectedAccountId, isAuthenticated, authChecked]);



  // Merge scaling trades: same symbol, same direction, same date = combine quantities
  // Example: Buy 2 MNQ + Buy 2 MNQ = 4 MNQ (1 trade)
  // Continues until contracts reach 0 or direction reverses
  const mergeScalingTrades = (trades: Trade[]): Trade[] => {
    if (trades.length === 0) return trades;
    
    console.log(`[mergeScalingTrades] Processing ${trades.length} trades`);
    
    // Only merge trades that share the EXACT same exit timestamp (truly scaling trades)
    // Group by symbol, position, date, accountId, AND exit timestamp
    const tradeGroups = new Map<string, Trade[]>();
    
    for (const trade of trades) {
      // Create a key: symbol-position-date-accountId-exitTimestamp
      // Only merge if they have the EXACT same exit time (scaling in/out of same position)
      const exitKey = trade.exitTime && trade.exitDate
        ? `${trade.symbol}-${trade.position}-${trade.date}-${trade.accountId || 'none'}-${trade.exitDate}-${trade.exitTime}`
        : `${trade.symbol}-${trade.position}-${trade.date}-${trade.accountId || 'none'}-${trade.id}`; // Unique key for open trades
      
      if (!tradeGroups.has(exitKey)) {
        tradeGroups.set(exitKey, []);
      }
      tradeGroups.get(exitKey)!.push(trade);
    }
    
    console.log(`[mergeScalingTrades] Grouped into ${tradeGroups.size} groups`);
    
    const mergedTrades: Trade[] = [];
    
    // Process each group
    for (const [key, groupTrades] of tradeGroups) {
      if (groupTrades.length === 1) {
        // Single trade, no merging needed
        mergedTrades.push(groupTrades[0]);
        continue;
      }
      
      console.log(`[mergeScalingTrades] Merging ${groupTrades.length} trades with key: ${key}`);
      console.log(`[mergeScalingTrades] Trades:`, groupTrades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        quantity: t.quantity,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        exitDate: t.exitDate
      })));
      
      // Multiple trades with same exit timestamp - merge them
      // Sort by entry time to process chronologically
      const sorted = [...groupTrades].sort((a, b) => {
        if (a.entryTime && b.entryTime) {
          const timeA = new Date(`${a.date}T${a.entryTime}`).getTime();
          const timeB = new Date(`${b.date}T${b.entryTime}`).getTime();
          return timeA - timeB;
        }
        return 0;
      });
      
      // Start with first trade
      const merged: Trade = { ...sorted[0] };
      let totalQuantity = sorted[0].quantity;
      let totalEntryValue = sorted[0].entryPrice * sorted[0].quantity;
      let totalPnL = sorted[0].pnl || 0;
      let earliestEntryTime = sorted[0].entryTime;
      
      // Merge remaining trades
      for (let i = 1; i < sorted.length; i++) {
        const trade = sorted[i];
        
        // Calculate weighted average entry price
        totalEntryValue += trade.entryPrice * trade.quantity;
        totalQuantity += trade.quantity;
        
        // Sum PnL
        if (trade.pnl !== undefined) {
          totalPnL += trade.pnl;
        }
        
        // Update earliest entry time
        if (trade.entryTime && earliestEntryTime) {
          const timeA = new Date(`${merged.date}T${earliestEntryTime}`).getTime();
          const timeB = new Date(`${trade.date}T${trade.entryTime}`).getTime();
          if (timeB < timeA) {
            earliestEntryTime = trade.entryTime;
          }
        }
        
        // Merge tags
        if (trade.tags && trade.tags.length > 0) {
          const existingTags = merged.tags || [];
          merged.tags = [...new Set([...existingTags, ...trade.tags])];
        }
      }
      
      // Update merged trade
      merged.quantity = totalQuantity;
      merged.entryPrice = totalEntryValue / totalQuantity;
      merged.pnl = totalPnL;
      merged.entryTime = earliestEntryTime;
      
      mergedTrades.push(merged);
    }
    
    console.log(`[mergeScalingTrades] Result: ${trades.length} trades -> ${mergedTrades.length} trades`);
    return mergedTrades;
  };

  const addTrade = async (trade: Trade | Trade[]) => {
    const tradesToAdd = Array.isArray(trade) ? trade : [trade];
    console.log(`[App] Adding ${tradesToAdd.length} trade(s) to state`);
    console.log(`[App] Trades to add:`, tradesToAdd.map(t => ({
      id: t.id,
      symbol: t.symbol,
      quantity: t.quantity,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      exitDate: t.exitDate,
      position: t.position
    })));
    
    // Merge scaling trades before adding to state (only merge new trades with each other)
    const mergedTrades = mergeScalingTrades(tradesToAdd);
    console.log(`[App] After initial merge: ${mergedTrades.length} trade(s)`);
    
    // Calculate new trades state using functional update
    setTrades(prevTrades => {
      console.log(`[App] Existing trades in state: ${prevTrades.length}`);
      
      // Merge with existing trades too (this might merge new trades with existing ones)
      const allTrades = [...prevTrades, ...mergedTrades];
      const finalMergedTrades = mergeScalingTrades(allTrades);
      console.log(`[App] Total trades in state: ${finalMergedTrades.length} (after merging with existing)`);
      console.log(`[App] Final trades:`, finalMergedTrades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        quantity: t.quantity,
        entryTime: t.entryTime,
        exitTime: t.exitTime
      })));
      
      // Save to Firebase after state update
      if (!isAuthenticated || !authChecked) {
        console.warn('[App] Cannot save trade - not authenticated yet. isAuthenticated:', isAuthenticated, 'authChecked:', authChecked);
        // Wait a bit and retry
        setTimeout(async () => {
          if (isAuthenticated && authChecked) {
            try {
              const { saveTrades } = await import('./services/tradeStorage');
              // Get current state and save
              setTrades(currentTrades => {
                saveTrades(currentTrades).then(() => {
                  console.log(`[App] Successfully saved ${currentTrades.length} trades to Firebase (retry)`);
                }).catch(error => {
                  console.error('[App] Error saving trades to Firebase (retry):', error);
                  console.error('[App] Error details:', {
                    code: error.code,
                    message: error.message
                  });
                  alert(`Failed to save trades: ${error.message || 'Unknown error'}. Check console for details.`);
                });
                return currentTrades;
              });
            } catch (error: any) {
              console.error('[App] Error importing saveTrades (retry):', error);
            }
          }
        }, 1000);
        return finalMergedTrades;
      }
      
      // Save immediately with the merged trades
      import('./services/tradeStorage').then(({ saveTrades }) => {
        saveTrades(finalMergedTrades).then(() => {
          console.log(`[App] Successfully saved ${finalMergedTrades.length} trades to Firebase`);
        }).catch(error => {
          console.error('[App] Error saving trades to Firebase:', error);
          console.error('[App] Error details:', {
            code: error?.code,
            message: error?.message,
            stack: error?.stack
          });
          alert(`Failed to save trades: ${error?.message || 'Unknown error'}. Check console for details.`);
        });
      }).catch(error => {
        console.error('[App] Error importing saveTrades:', error);
        alert(`Failed to save trades: ${error?.message || 'Unknown error'}`);
      });
      
      return finalMergedTrades;
    });
  };

  const updateTrade = async (updatedTrade: Trade) => {
    setTrades(prevTrades => {
      const updatedTrades = prevTrades.map(trade => trade.id === updatedTrade.id ? updatedTrade : trade);
      
      // Immediately save to Firebase to ensure update persists
      if (isAuthenticated && authChecked) {
        import('./services/tradeStorage').then(({ saveTrades }) => {
          saveTrades(updatedTrades).then(() => {
            console.log(`[App] Successfully saved updated trade to Firebase`);
          }).catch(error => {
            console.error('[App] Error saving updated trade to Firebase:', error);
          });
        });
      }
      
      return updatedTrades;
    });
  };

  const deleteTrade = async (id: string) => {
    setIsDeleting(true);
    
    // Delete from Firebase first, then update state
    if (isAuthenticated && authChecked) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { initializeFirebase } = await import('./services/firebase');
        const { db, auth } = await initializeFirebase();
        
        if (db && auth?.currentUser) {
          const userId = auth.currentUser.uid;
          const tradeRef = doc(db, 'users', userId, 'trades', id);
          await deleteDoc(tradeRef);
          console.log(`[App] Successfully deleted trade ${id} from Firebase`);
        }
      } catch (error) {
        console.error('[App] Error deleting trade from Firebase:', error);
      }
    }
    
    // Update state after Firebase deletion
    setTrades(prevTrades => {
      const updatedTrades = prevTrades.filter(trade => trade.id !== id);
      setIsDeleting(false);
      return updatedTrades;
    });
  };

  const deleteTrades = async (ids: string[]) => {
    setIsDeleting(true);
    
    // Delete from Firebase first, then update state
    if (isAuthenticated && authChecked) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { initializeFirebase } = await import('./services/firebase');
        const { db, auth } = await initializeFirebase();
        
        if (db && auth?.currentUser) {
          const userId = auth.currentUser.uid;
          // Delete all trades in parallel
          await Promise.all(ids.map(id => {
            const tradeRef = doc(db, 'users', userId, 'trades', id);
            return deleteDoc(tradeRef);
          }));
          console.log(`[App] Successfully deleted ${ids.length} trade(s) from Firebase`);
        }
      } catch (error) {
        console.error('[App] Error deleting trades from Firebase:', error);
      }
    }
    
    // Update state after Firebase deletions
    setTrades(prevTrades => {
      const updatedTrades = prevTrades.filter(trade => !ids.includes(trade.id));
      setIsDeleting(false);
      return updatedTrades;
    });
  };

  const addAccount = async (accountData: Omit<Account, 'id'>) => {
    if (!isAuthenticated || !authChecked) {
      console.warn('[App] Cannot add account - not authenticated yet');
      alert('Please wait for authentication to complete before adding accounts.');
      return;
    }
    
    // Generate ID for new account
    const account: Account = {
      ...accountData,
      id: Date.now().toString()
    };
    
    console.log(`[App] Adding account: ${account.name} (ID: ${account.id})`);
    console.log(`[App] Account data:`, JSON.stringify(account, null, 2));
    
    setAccounts(prevAccounts => {
      const newAccounts = [...prevAccounts, account];
      console.log(`[App] Total accounts after adding: ${newAccounts.length}`);
      
      // Save to Firebase immediately
      import('./services/tradeStorage').then(({ saveAccounts }) => {
        console.log(`[App] Saving ${newAccounts.length} accounts to Firebase...`);
        saveAccounts(newAccounts).then(() => {
          console.log(`[App] ✅ Successfully saved ${newAccounts.length} accounts to Firebase`);
          console.log(`[App] New account ${account.id} (${account.name}) should now be in Firebase`);
        }).catch(error => {
          console.error('[App] ❌ Error saving accounts to Firebase:', error);
          console.error('[App] Error details:', {
            code: error?.code,
            message: error?.message,
            stack: error?.stack
          });
          alert(`Failed to save account: ${error?.message || 'Unknown error'}. Check console for details.`);
        });
      }).catch(error => {
        console.error('[App] Error importing saveAccounts:', error);
        alert(`Failed to save account: ${error?.message || 'Unknown error'}`);
      });
      
      return newAccounts;
    });
  };

  const updateAccount = async (id: string, accountData: Partial<Account>) => {
    console.log(`[App] Updating account ID: ${id} with data:`, accountData);
    
    if (!isAuthenticated || !authChecked) {
      console.warn('[App] Cannot update account - not authenticated yet');
      alert('Please wait for authentication to complete before updating accounts.');
      return;
    }
    
    setAccounts(prevAccounts => {
      const accountToUpdate = prevAccounts.find(acc => acc.id === id);
      if (!accountToUpdate) {
        console.error(`[App] Account with ID ${id} not found in state`);
        alert(`Account not found. Please refresh and try again.`);
        return prevAccounts;
      }
      
      const updatedAccount = { ...accountToUpdate, ...accountData };
      const newAccounts = prevAccounts.map(account => {
        if (account.id === id) {
          return updatedAccount;
        }
        return account;
      });
      
      console.log(`[App] Updated account in state:`, updatedAccount);
      console.log(`[App] Total accounts after update: ${newAccounts.length}`);
      
      // Save to Firebase immediately
      import('./services/tradeStorage').then(({ saveAccounts }) => {
        console.log(`[App] Saving ${newAccounts.length} accounts to Firebase...`);
        saveAccounts(newAccounts).then(() => {
          console.log(`[App] ✅ Successfully saved ${newAccounts.length} accounts to Firebase`);
          console.log(`[App] Account ${id} updated with:`, accountData);
        }).catch(error => {
          console.error('[App] ❌ Error saving updated accounts to Firebase:', error);
          console.error('[App] Error details:', {
            code: error?.code,
            message: error?.message,
            stack: error?.stack
          });
          alert(`Failed to save account update: ${error?.message || 'Unknown error'}. Check console for details.`);
        });
      }).catch(error => {
        console.error('[App] Error importing saveAccounts:', error);
        alert(`Failed to save account update: ${error?.message || 'Unknown error'}`);
      });
      
      return newAccounts;
    });
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
    const closedTrades = accountTrades.filter(trade => trade.status === 'closed');
    const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const tradeCount = accountTrades.length;
    const closedTradeCount = closedTrades.length;
    const winningTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0).length;
    const winRate = closedTradeCount > 0 ? (winningTrades / closedTradeCount) * 100 : 0;

    return { totalPnL, tradeCount, closedTradeCount, winRate };
  };



  const handleLogout = async () => {
    try {
      const { logout } = await import('./services/auth');
      await logout();
      setIsAuthenticated(false);
      setShowLanding(true);
    } catch (error) {
      console.error('Logout failed', error);
    }
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

  // Show loading state while checking authentication
  if (!authChecked) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'dark' : ''}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Require authentication to access the app
  if (!isAuthenticated || !user) {
    return (
      <SignIn
        onBack={() => setShowLanding(true)}
        isDarkMode={darkMode}
        onThemeToggle={() => setDarkMode(!darkMode)}
        onSignIn={() => {
          // This will be handled by auth state change, but we can also set it here
          setShowLanding(false);
        }}
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
              <ErrorBoundary>
                <Dashboard trades={filteredTrades} onNavigateToJournal={() => setActiveTab('journal')} />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="gameplan">
              <Gameplan />
            </TabsContent>

            <TabsContent value="accounts">
              <AccountManager
                accounts={accounts}
                onAddAccount={(accountData) => {
                  // addAccount expects Omit<Account, 'id'> and will generate the ID
                  addAccount(accountData);
                }}
                onUpdateAccount={(id, accountData) => {
                  updateAccount(id, accountData);
                }}
                selectedAccountId={selectedAccountId}
                onSelectAccount={setSelectedAccountId}
                getAccountStats={getAccountStats}
                trades={trades}
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
                onDeleteTrades={deleteTrades}
                accounts={accounts}
              />
            </TabsContent>

            <TabsContent value="journal" className="space-y-6">
              <ErrorBoundary>
                <JournalAnalysis />
              </ErrorBoundary>
            </TabsContent>
          </Tabs>
        </main>

        {/* Floating MIA Window - Like Gemini on Chrome */}
        <FloatingMIA isOpen={isMIADialogOpen} onClose={() => setIsMIADialogOpen(false)} />
      </div>
    </div>
  );
}