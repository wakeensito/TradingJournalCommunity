import { useMemo, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell as RechartsCell, 
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, BarChart3, Flame, Clock, TrendingDown as TrendingDownIcon, Activity, type LucideIcon } from 'lucide-react';
import { Trade } from '../types/trade';
import { CalendarView } from './CalendarView';

type StatTone = 'neutral' | 'green' | 'red' | 'blue' | 'orange' | 'yellow';

const STAT_TONE: Record<StatTone, string> = {
  neutral: 'text-muted-foreground/60',
  green: 'text-green-500/70',
  red: 'text-red-500/70',
  blue: 'text-blue-500/70',
  orange: 'text-orange-500/70',
  yellow: 'text-yellow-500/70',
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  icon: LucideIcon;
  tone?: StatTone;
  children?: ReactNode;
}

function StatCard({ label, value, valueClassName, icon: Icon, tone = 'neutral', children }: StatCardProps) {
  return (
    <Card className="hover-glow group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 shrink-0 transition-opacity group-hover:opacity-100 ${STAT_TONE[tone]}`} />
        </div>
        <p className={`mt-3 text-2xl tabular-nums ${valueClassName ?? ''}`}>{value}</p>
        {children ? <div className="mt-1 space-y-0.5">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

interface DashboardProps {
  trades: Trade[];
  onNavigateToJournal?: () => void;
}

export function Dashboard({ trades }: DashboardProps) {
  const stats = useMemo(() => {
    // Ensure trades is an array
    if (!trades || !Array.isArray(trades)) {
      return {
        totalTrades: 0,
        closedTrades: 0,
        openTrades: 0,
        totalPnL: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        expectancy: 0,
        avgRiskReward: 0,
        tradesWithRR: 0,
        avgDuration: 'N/A',
        tradesWithDuration: 0,
        currentStreak: 0,
        streakType: 'none' as const
      };
    }
    
    const closedTrades = trades.filter(trade => trade.status === 'closed');
    const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winningTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(trade => (trade.pnl || 0) < 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / winningTrades.length 
      : 0;
    
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / losingTrades.length)
      : 0;

    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Calculate Expectancy: (Win% × Avg Win) - (Loss% × Avg Loss)
    const winPercentage = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;
    const lossPercentage = closedTrades.length > 0 ? losingTrades.length / closedTrades.length : 0;
    const expectancy = (winPercentage * avgWin) - (lossPercentage * avgLoss);

    // Calculate average risk-reward ratio
    const tradesWithRR = trades.filter(trade => trade.riskRewardRatio && trade.riskRewardRatio > 0);
    const avgRiskReward = tradesWithRR.length > 0 
      ? tradesWithRR.reduce((sum, trade) => sum + (trade.riskRewardRatio || 0), 0) / tradesWithRR.length
      : 0;

    // Calculate average duration
    const parseDurationToMinutes = (duration: string): number => {
      let totalMinutes = 0;
      const dayMatch = duration.match(/(\d+)d/);
      const hourMatch = duration.match(/(\d+)h/);
      const minMatch = duration.match(/(\d+)m/);
      
      if (dayMatch) totalMinutes += parseInt(dayMatch[1]) * 24 * 60;
      if (hourMatch) totalMinutes += parseInt(hourMatch[1]) * 60;
      if (minMatch) totalMinutes += parseInt(minMatch[1]);
      
      return totalMinutes;
    };

    const formatMinutesToDuration = (minutes: number): string => {
      if (minutes === 0) return 'N/A';
      
      const days = Math.floor(minutes / (24 * 60));
      const hours = Math.floor((minutes % (24 * 60)) / 60);
      const mins = Math.floor(minutes % 60);
      
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0) parts.push(`${mins}m`);
      
      return parts.join(' ') || '0m';
    };

    const tradesWithDuration = closedTrades.filter(trade => trade.duration);
    const avgDuration = tradesWithDuration.length > 0
      ? tradesWithDuration.reduce((sum, trade) => sum + parseDurationToMinutes(trade.duration!), 0) / tradesWithDuration.length
      : 0;
    const avgDurationFormatted = formatMinutesToDuration(avgDuration);

    // Calculate current streak (daily-based)
    // Group trades by date and sum P&L per day
    const dailyPnL = new Map<string, number>();
    
    closedTrades.forEach(trade => {
      const date = trade.date; // Use date string as key
      const currentPnL = dailyPnL.get(date) || 0;
      dailyPnL.set(date, currentPnL + (trade.pnl || 0));
    });
    
    // Convert to array of {date, pnl} and sort by date (most recent first)
    const sortedDays = Array.from(dailyPnL.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let currentStreak = 0;
    let streakType: 'win' | 'loss' | 'none' = 'none';
    
    if (sortedDays.length > 0) {
      const firstDay = sortedDays[0];
      const isWinDay = firstDay.pnl > 0;
      streakType = isWinDay ? 'win' : 'loss';
      
      // Count consecutive days with the same sign
      for (const day of sortedDays) {
        const dayIsWin = day.pnl > 0;
        // Break streak if day is neutral (exactly 0) or different sign
        if (day.pnl === 0 || dayIsWin !== isWinDay) {
          break;
        }
        currentStreak++;
      }
    }

    return {
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      openTrades: trades.filter(trade => trade.status === 'open').length,
      totalPnL,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      avgRiskReward,
      tradesWithRR: tradesWithRR.length,
      avgDuration: avgDurationFormatted,
      tradesWithDuration: tradesWithDuration.length,
      currentStreak,
      streakType
    };
  }, [trades]);

  const cumulativePnL = useMemo(() => {
    const closedTrades = trades
      .filter(trade => trade.status === 'closed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    return closedTrades.map(trade => {
      cumulative += trade.pnl || 0;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      return {
        date: trade.date,
        cumulative,
        pnl: trade.pnl || 0,
        peak,
        drawdown
      };
    });
  }, [trades]);

  // Calculate Maximum Drawdown
  const maxDrawdown = useMemo(() => {
    if (cumulativePnL.length === 0) return { value: 0, percentage: 0 };
    
    let peak = 0;
    let maxDD = 0;
    let maxDDPercentage = 0;
    
    cumulativePnL.forEach(point => {
      if (point.cumulative > peak) {
        peak = point.cumulative;
      }
      const drawdown = peak - point.cumulative;
      if (drawdown > maxDD) {
        maxDD = drawdown;
        maxDDPercentage = peak > 0 ? (drawdown / peak) * 100 : 0;
      }
    });
    
    return { value: maxDD, percentage: maxDDPercentage };
  }, [cumulativePnL]);

  const symbolPerformance = useMemo(() => {
    const symbolMap = new Map<string, { pnl: number, count: number }>();
    
    trades.filter(trade => trade.status === 'closed').forEach(trade => {
      const existing = symbolMap.get(trade.symbol) || { pnl: 0, count: 0 };
      symbolMap.set(trade.symbol, {
        pnl: existing.pnl + (trade.pnl || 0),
        count: existing.count + 1
      });
    });

    return Array.from(symbolMap.entries())
      .map(([symbol, data]) => ({
        symbol,
        pnl: data.pnl,
        count: data.count,
        avgPnL: data.pnl / data.count
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 10);
  }, [trades]);

  const monthlyPerformance = useMemo(() => {
    const monthlyMap = new Map<string, number>();
    
    trades.filter(trade => trade.status === 'closed').forEach(trade => {
      const parsed = new Date(trade.date);
      if (isNaN(parsed.getTime())) return; // skip trades with an unparseable date
      const month = parsed.toISOString().substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + (trade.pnl || 0));
    });

    return Array.from(monthlyMap.entries())
      .map(([month, pnl]) => ({ month, pnl }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [trades]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const pieData = [
    { name: 'Winning Trades', value: stats.winningTrades, color: '#22c55e' },
    { name: 'Losing Trades', value: stats.losingTrades, color: '#ef4444' }
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total P&L"
          icon={DollarSign}
          tone={stats.totalPnL >= 0 ? 'green' : 'red'}
          value={formatCurrency(stats.totalPnL)}
          valueClassName={stats.totalPnL >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}
        />

        <StatCard
          label="Avg R:R Ratio"
          icon={TrendingUp}
          tone={stats.avgRiskReward >= 2 ? 'green' : stats.avgRiskReward >= 1 ? 'yellow' : 'red'}
          value={stats.avgRiskReward > 0 ? `1:${stats.avgRiskReward.toFixed(2)}` : 'N/A'}
          valueClassName={stats.avgRiskReward >= 2 ? 'text-green-600 dark:text-green-500' : stats.avgRiskReward >= 1 ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-600 dark:text-red-500'}
        >
          <p className="text-xs text-muted-foreground tabular-nums">{stats.tradesWithRR} trades with R:R</p>
        </StatCard>

        <StatCard label="Total Trades" icon={BarChart3} tone="blue" value={stats.totalTrades}>
          <div className="flex gap-2 pt-1">
            <Badge variant="outline" className="text-xs transition-all hover:scale-105">{stats.openTrades} open</Badge>
            <Badge variant="outline" className="text-xs transition-all hover:scale-105">{stats.closedTrades} closed</Badge>
          </div>
        </StatCard>

        <StatCard label="Profit Factor" icon={Calendar} value={stats.profitFactor.toFixed(2)}>
          <p className="text-xs text-muted-foreground tabular-nums">Avg Win: {formatCurrency(stats.avgWin)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">Avg Loss: {formatCurrency(stats.avgLoss)}</p>
        </StatCard>

        <StatCard label="Average Duration" icon={Clock} tone="blue" value={stats.avgDuration} valueClassName="text-blue-600 dark:text-blue-500">
          <p className="text-xs text-muted-foreground tabular-nums">{stats.tradesWithDuration} trades</p>
        </StatCard>

        <StatCard
          label="Current Streak"
          icon={Flame}
          tone={stats.streakType === 'win' ? 'orange' : stats.streakType === 'loss' ? 'red' : 'neutral'}
          value={stats.currentStreak > 0 ? stats.currentStreak : 'N/A'}
          valueClassName={stats.streakType === 'win' ? 'text-green-600 dark:text-green-500' : stats.streakType === 'loss' ? 'text-red-600 dark:text-red-500' : ''}
        >
          <p className="text-xs text-muted-foreground tabular-nums">{stats.streakType === 'win' ? `${stats.currentStreak} winning` : stats.streakType === 'loss' ? `${stats.currentStreak} losing` : 'No trades'}</p>
        </StatCard>

        <StatCard
          label="Expectancy"
          icon={Activity}
          tone={stats.expectancy >= 0 ? 'green' : 'red'}
          value={formatCurrency(stats.expectancy)}
          valueClassName={stats.expectancy >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}
        >
          <p className="text-xs text-muted-foreground tabular-nums">Per trade expected value</p>
        </StatCard>

        <StatCard
          label="Max Drawdown"
          icon={TrendingDownIcon}
          tone={maxDrawdown.value === 0 ? 'neutral' : 'red'}
          value={formatCurrency(maxDrawdown.value)}
          valueClassName={maxDrawdown.value === 0 ? 'text-gray-600 dark:text-gray-500' : 'text-red-600 dark:text-red-500'}
        >
          <p className="text-xs text-muted-foreground tabular-nums">{maxDrawdown.percentage > 0 ? `${maxDrawdown.percentage.toFixed(1)}%` : 'No drawdown'}</p>
        </StatCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative P&L Chart */}
        <Card className="hover-glow">
          <CardHeader>
            <CardTitle>Cumulative P&L</CardTitle>
          </CardHeader>
          <CardContent>
            {cumulativePnL.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={cumulativePnL}>
                  <defs>
                    <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    stroke="currentColor"
                    opacity={0.5}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    stroke="currentColor"
                    opacity={0.5}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    formatter={(value: number) => [formatCurrency(value), 'Cumulative P&L']}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(12px)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cumulative" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fill="url(#colorPnL)"
                    dot={false}
                    activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                No closed trades to display
              </div>
            )}
          </CardContent>
        </Card>

        {/* Win/Loss Distribution */}
        <Card className="hover-glow">
          <CardHeader>
            <CardTitle>Win/Loss Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.closedTrades > 0 ? (
              <div className="flex flex-col md:flex-row items-center md:justify-between gap-6 md:gap-0 md:h-[300px]">
                {/* Donut Chart */}
                <div className="relative w-full md:flex-1">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry, index) => (
                          <RechartsCell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-3xl tabular-nums">{stats.winRate.toFixed(2)}%</p>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex flex-col gap-4 md:ml-8 w-full md:w-auto">
                  <div className="flex items-center justify-between gap-8">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm">Winners</span>
                    </div>
                    <span className="text-sm tabular-nums">{stats.winningTrades}</span>
                  </div>
                  <div className="flex items-center justify-between gap-8">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm">Losers</span>
                    </div>
                    <span className="text-sm tabular-nums">{stats.losingTrades}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                No closed trades to display
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Calendar View */}
      <CalendarView trades={trades} />
    </div>
  );
}