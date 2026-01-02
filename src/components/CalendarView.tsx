import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar } from './ui/calendar';
import { Trade } from '../types/trade';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

interface CalendarViewProps {
  trades: Trade[];
}

interface TradeDay {
  date: string;
  trades: Trade[];
  totalPnl: number;
  winCount: number;
  lossCount: number;
}

export function CalendarView({ trades }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const grouped = new Map<string, TradeDay>();

    trades.forEach((trade) => {
      if (!grouped.has(trade.date)) {
        grouped.set(trade.date, {
          date: trade.date,
          trades: [],
          totalPnl: 0,
          winCount: 0,
          lossCount: 0,
        });
      }

      const day = grouped.get(trade.date)!;
      day.trades.push(trade);

      if (trade.status === 'closed' && trade.pnl !== undefined) {
        day.totalPnl += trade.pnl;
        if (trade.pnl > 0) {
          day.winCount++;
        } else if (trade.pnl < 0) {
          day.lossCount++;
        }
      }
    });

    return grouped;
  }, [trades]);

  // Get trades for selected date
  const selectedDateTrades = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = selectedDate.toISOString().split('T')[0];
    return tradesByDate.get(dateStr);
  }, [selectedDate, tradesByDate]);

  // Custom day content renderer
  const modifiers = useMemo(() => {
    const profitDays: Date[] = [];
    const lossDays: Date[] = [];
    const neutralDays: Date[] = [];

    tradesByDate.forEach((day) => {
      const date = new Date(day.date + 'T00:00:00');
      if (day.totalPnl > 0) {
        profitDays.push(date);
      } else if (day.totalPnl < 0) {
        lossDays.push(date);
      } else if (day.trades.length > 0) {
        neutralDays.push(date);
      }
    });

    return {
      profit: profitDays,
      loss: lossDays,
      neutral: neutralDays,
    };
  }, [tradesByDate]);

  const modifiersClassNames = {
    profit: 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40 font-semibold',
    loss: 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 font-semibold',
    neutral: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/40 font-semibold',
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const openTradeDialog = (trade: Trade) => {
    setSelectedTrade(trade);
  };

  const closeTradeDialog = () => {
    setSelectedTrade(null);
  };

  // Get all trades sorted by date for navigation
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      // If same date, maintain original order
      return 0;
    });
  }, [trades]);

  // Find current trade index and navigation functions
  const currentTradeIndex = useMemo(() => {
    if (!selectedTrade) return -1;
    return sortedTrades.findIndex(t => t.id === selectedTrade.id);
  }, [selectedTrade, sortedTrades]);

  const handlePreviousTrade = () => {
    if (currentTradeIndex > 0) {
      const prevTrade = sortedTrades[currentTradeIndex - 1];
      setSelectedTrade(prevTrade);
      // Update selected date if moving to a different day
      const prevDate = new Date(prevTrade.date + 'T00:00:00');
      setSelectedDate(prevDate);
    }
  };

  const handleNextTrade = () => {
    if (currentTradeIndex < sortedTrades.length - 1) {
      const nextTrade = sortedTrades[currentTradeIndex + 1];
      setSelectedTrade(nextTrade);
      // Update selected date if moving to a different day
      const nextDate = new Date(nextTrade.date + 'T00:00:00');
      setSelectedDate(nextDate);
    }
  };

  const hasPreviousTrade = currentTradeIndex > 0;
  const hasNextTrade = currentTradeIndex < sortedTrades.length - 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Section */}
      <Card className="lg:col-span-2 hover-glow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Trading Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="h-8"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentDate}
              onMonthChange={setCurrentDate}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className="rounded-xl border shadow-sm"
            />
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-950/30 border border-green-300 dark:border-green-800" />
              <span className="text-muted-foreground">Profitable Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-800" />
              <span className="text-muted-foreground">Loss Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800" />
              <span className="text-muted-foreground">Open Trades Only</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      <Card className="hover-glow">
        <CardHeader>
          <CardTitle>
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a Date'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateTrades ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total P&L</span>
                  <span
                    className={`font-semibold ${
                      selectedDateTrades.totalPnl > 0
                        ? 'text-green-600 dark:text-green-500'
                        : selectedDateTrades.totalPnl < 0
                        ? 'text-red-600 dark:text-red-500'
                        : ''
                    }`}
                  >
                    {selectedDateTrades.totalPnl > 0 ? '+' : ''}$
                    {selectedDateTrades.totalPnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Trades</span>
                  <span className="font-semibold">{selectedDateTrades.trades.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Win/Loss</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                      {selectedDateTrades.winCount}W
                    </Badge>
                    <Badge variant="outline" className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                      {selectedDateTrades.lossCount}L
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Trades List */}
              <div className="space-y-2">
                <h4 className="text-sm text-muted-foreground mb-3">Trades on this day:</h4>
                {selectedDateTrades.trades.map((trade) => (
                  <div
                    key={trade.id}
                    onClick={() => openTradeDialog(trade)}
                    className="rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{trade.symbol}</span>
                        <Badge variant="outline" className="text-xs">
                          {trade.assetType?.charAt(0).toUpperCase() + trade.assetType?.slice(1) || 'Stock'}
                        </Badge>
                        {trade.assetType === 'futures' && trade.contractType && (
                          <Badge variant="secondary" className="text-xs">
                            {trade.contractType === 'mini' ? 'Mini' : 'Micro'}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            trade.position === 'long'
                              ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                              : 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                          }
                        >
                          {trade.position === 'long' ? 'LONG (BUY)' : 'SHORT (SELL)'}
                        </Badge>
                      </div>
                      {trade.status === 'closed' && trade.pnl !== undefined && (
                        <div className="flex items-center gap-1">
                          {trade.pnl > 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-500" />
                          )}
                          <span
                            className={`text-sm font-semibold ${
                              trade.pnl > 0
                                ? 'text-green-600 dark:text-green-500'
                                : 'text-red-600 dark:text-red-500'
                            }`}
                          >
                            {trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Entry: ${trade.entryPrice.toFixed(2)}</span>
                        {trade.exitPrice && (
                          <span>Exit: ${trade.exitPrice.toFixed(2)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Qty: {trade.quantity}</span>
                        <Badge variant="secondary" className="text-xs">
                          {trade.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    {trade.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                        {trade.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-4">📅</div>
              <p className="text-muted-foreground">
                {selectedDate
                  ? 'No trades on this date'
                  : 'Select a date to view trade details'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade Details Dialog */}
      <Dialog open={selectedTrade !== null} onOpenChange={(open) => !open && closeTradeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTrade && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 pr-8">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePreviousTrade}
                    disabled={!hasPreviousTrade}
                    className="h-8 w-8 shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <DialogTitle className="flex flex-wrap items-center justify-center gap-2">
                      <span>{selectedTrade.symbol}</span>
                      <Badge variant="outline">
                        {selectedTrade.assetType?.charAt(0).toUpperCase() + selectedTrade.assetType?.slice(1) || 'Stock'}
                      </Badge>
                      {selectedTrade.assetType === 'futures' && selectedTrade.contractType && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedTrade.contractType === 'mini' ? 'Mini' : 'Micro'}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          selectedTrade.position === 'long'
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                            : 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                        }
                      >
                        {selectedTrade.position === 'long' ? 'LONG (BUY)' : 'SHORT (SELL)'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {selectedTrade.status.toUpperCase()}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      {new Date(selectedTrade.date + 'T00:00:00').toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </DialogDescription>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextTrade}
                    disabled={!hasNextTrade}
                    className="h-8 w-8 shrink-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4 sm:space-y-6 mt-4">
                {/* P&L Summary */}
                {selectedTrade.status === 'closed' && selectedTrade.pnl !== undefined && (
                  <div className="p-3 sm:p-4 rounded-lg bg-muted border-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Profit & Loss</span>
                      <div className="flex items-center gap-2">
                        {selectedTrade.pnl > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-500" />
                        )}
                        <span
                          className={`text-lg sm:text-xl font-semibold ${
                            selectedTrade.pnl > 0
                              ? 'text-green-600 dark:text-green-500'
                              : 'text-red-600 dark:text-red-500'
                          }`}
                        >
                          {selectedTrade.pnl > 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trade Breakdown */}
                <div>
                  <h5 className="text-sm mb-2 sm:mb-3 text-muted-foreground">Trade Breakdown</h5>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="bg-muted p-2 sm:p-3 rounded-lg border-2">
                      <div className="text-xs text-muted-foreground mb-1">Entry Price</div>
                      <div className="text-base sm:text-lg">${selectedTrade.entryPrice.toFixed(2)}</div>
                    </div>
                    {selectedTrade.exitPrice && (
                      <div className="bg-muted p-2 sm:p-3 rounded-lg border-2">
                        <div className="text-xs text-muted-foreground mb-1">Exit Price</div>
                        <div className="text-base sm:text-lg">${selectedTrade.exitPrice.toFixed(2)}</div>
                      </div>
                    )}
                    <div className="bg-muted p-2 sm:p-3 rounded-lg border-2">
                      <div className="text-xs text-muted-foreground mb-1">Quantity</div>
                      <div className="text-base sm:text-lg">{selectedTrade.quantity}</div>
                    </div>
                    <div className="bg-muted p-2 sm:p-3 rounded-lg border-2">
                      <div className="text-xs text-muted-foreground mb-1">Total Cost</div>
                      <div className="text-base sm:text-lg">${(selectedTrade.quantity * selectedTrade.entryPrice).toFixed(2)}</div>
                    </div>
                    {selectedTrade.exitPrice && (
                      <div className="bg-muted p-2 sm:p-3 rounded-lg border-2">
                        <div className="text-xs text-muted-foreground mb-1">Total Revenue</div>
                        <div className="text-base sm:text-lg">${(selectedTrade.quantity * selectedTrade.exitPrice).toFixed(2)}</div>
                      </div>
                    )}
                    {selectedTrade.riskRewardRatio && (
                      <div className="bg-muted p-2 sm:p-3 rounded-lg border-2">
                        <div className="text-xs text-muted-foreground mb-1">R:R Ratio</div>
                        <div className={`text-base sm:text-lg ${
                          selectedTrade.riskRewardRatio >= 2 
                            ? 'text-green-600 dark:text-green-500' 
                            : selectedTrade.riskRewardRatio >= 1
                            ? 'text-yellow-600 dark:text-yellow-500'
                            : 'text-red-600 dark:text-red-500'
                        }`}>
                          1:{selectedTrade.riskRewardRatio.toFixed(2)}
                        </div>
                      </div>
                    )}
                    {selectedTrade.stopLoss && (
                      <div className="bg-muted p-2 sm:p-3 rounded-lg border-2">
                        <div className="text-xs text-muted-foreground mb-1">Stop Loss</div>
                        <div className="text-base sm:text-lg">${selectedTrade.stopLoss.toFixed(2)}</div>
                      </div>
                    )}
                    {selectedTrade.targetPrice && (
                      <div className="bg-muted p-2 sm:p-3 rounded-lg border-2">
                        <div className="text-xs text-muted-foreground mb-1">Target</div>
                        <div className="text-base sm:text-lg">${selectedTrade.targetPrice.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {selectedTrade.notes && (
                  <div>
                    <h5 className="text-sm mb-2 text-muted-foreground">Notes</h5>
                    <p className="text-sm bg-muted p-2 sm:p-3 rounded-lg border-2 whitespace-pre-wrap break-words">
                      {selectedTrade.notes}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {selectedTrade.tags && selectedTrade.tags.length > 0 && (
                  <div>
                    <h5 className="text-sm mb-2 text-muted-foreground">Tags</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedTrade.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Monthly Summary */}
      <Card className="lg:col-span-3 hover-glow">
        <CardHeader>
          <CardTitle>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
              const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
              
              const monthTrades = trades.filter((trade) => {
                const tradeDate = new Date(trade.date + 'T00:00:00');
                return tradeDate >= monthStart && tradeDate <= monthEnd;
              });

              const closedTrades = monthTrades.filter((t) => t.status === 'closed' && t.pnl !== undefined);
              const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
              const wins = closedTrades.filter((t) => (t.pnl || 0) > 0).length;
              const losses = closedTrades.filter((t) => (t.pnl || 0) < 0).length;
              const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

              const tradingDays = new Set(monthTrades.map((t) => t.date)).size;

              return (
                <>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Monthly P&L</p>
                    <p className={`text-2xl tabular-nums ${
                      totalPnl > 0
                        ? 'text-green-600 dark:text-green-500'
                        : totalPnl < 0
                        ? 'text-red-600 dark:text-red-500'
                        : ''
                    }`}>
                      {totalPnl > 0 ? '+' : ''}${totalPnl.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Total Trades</p>
                    <p className="text-2xl tabular-nums">{monthTrades.length}</p>
                    <p className="text-xs text-muted-foreground">{wins}W / {losses}L</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Win Rate</p>
                    <p className={`text-2xl tabular-nums ${
                      winRate >= 60
                        ? 'text-green-600 dark:text-green-500'
                        : winRate >= 40
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : 'text-red-600 dark:text-red-500'
                    }`}>
                      {winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Trading Days</p>
                    <p className="text-2xl tabular-nums">{tradingDays}</p>
                    <p className="text-xs text-muted-foreground">Active days</p>
                  </div>
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
