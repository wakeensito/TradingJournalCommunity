import { useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell as RechartsCell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
} from 'recharts';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus, Activity, Clock, Crosshair } from 'lucide-react';
import { Trade } from '../types/trade';
import { CalendarView } from './CalendarView';
import { JournalAnalysisCard } from './JournalAnalysisCard';

/* ─── Palette: deep navy-slate with warm amber accent ─── */
const AMBER = '#c9a84c';
const AMBER_DIM = 'rgba(201, 168, 76, 0.12)';
const AMBER_GLOW = 'rgba(201, 168, 76, 0.06)';
const GAIN = '#34d399';
const GAIN_DIM = 'rgba(52, 211, 153, 0.10)';
const GAIN_SOFT = 'rgba(52, 211, 153, 0.7)';
const LOSS = '#f87171';
const LOSS_DIM = 'rgba(248, 113, 113, 0.10)';
const LOSS_SOFT = 'rgba(248, 113, 113, 0.7)';
const GRID = 'rgba(255,255,255,0.03)';
const AXIS = 'rgba(255,255,255,0.18)';
const SURFACE = 'rgba(255,255,255,0.025)';
const SURFACE_HOVER = 'rgba(255,255,255,0.045)';
const BORDER = 'rgba(255,255,255,0.055)';
const BORDER_SUBTLE = 'rgba(255,255,255,0.035)';
const INK = 'rgba(255,255,255,0.90)';
const INK_2 = 'rgba(255,255,255,0.55)';
const INK_3 = 'rgba(255,255,255,0.30)';
const INK_4 = 'rgba(255,255,255,0.18)';

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'rgba(8, 12, 24, 0.96)',
  border: `1px solid rgba(201, 168, 76, 0.15)`,
  borderRadius: '8px',
  backdropFilter: 'blur(20px)',
  fontSize: '11px',
  color: INK,
  padding: '10px 14px',
  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
};

interface DashboardProps {
  trades: Trade[];
  onNavigateToJournal?: () => void;
}

export function Dashboard({ trades, onNavigateToJournal }: DashboardProps) {

  /* ═══════════════════════ DATA COMPUTATION ═══════════════════════ */

  const stats = useMemo(() => {
    if (!trades || !Array.isArray(trades)) {
      return {
        totalTrades: 0, closedTrades: 0, openTrades: 0, totalPnL: 0,
        winningTrades: 0, losingTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0,
        profitFactor: 0, expectancy: 0, avgRiskReward: 0, tradesWithRR: 0,
        avgDuration: 'N/A', tradesWithDuration: 0, currentStreak: 0,
        streakType: 'none' as const, bestDay: 0, worstDay: 0,
      };
    }

    const closedTrades = trades.filter(t => t.status === 'closed');
    const totalPnL = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + (t.pnl || 0), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((s, t) => s + (t.pnl || 0), 0) / losingTrades.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    const wp = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;
    const lp = closedTrades.length > 0 ? losingTrades.length / closedTrades.length : 0;
    const expectancy = (wp * avgWin) - (lp * avgLoss);
    const tradesWithRR = trades.filter(t => t.riskRewardRatio && t.riskRewardRatio > 0);
    const avgRiskReward = tradesWithRR.length > 0
      ? tradesWithRR.reduce((s, t) => s + (t.riskRewardRatio || 0), 0) / tradesWithRR.length : 0;

    const parseDur = (d: string) => {
      let m = 0;
      const dm = d.match(/(\d+)d/); const hm = d.match(/(\d+)h/); const mm = d.match(/(\d+)m/);
      if (dm) m += parseInt(dm[1]) * 1440; if (hm) m += parseInt(hm[1]) * 60; if (mm) m += parseInt(mm[1]);
      return m;
    };
    const fmtDur = (m: number) => {
      if (m === 0) return 'N/A';
      const d = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60); const mn = Math.floor(m % 60);
      const p: string[] = [];
      if (d > 0) p.push(`${d}d`); if (h > 0) p.push(`${h}h`); if (mn > 0) p.push(`${mn}m`);
      return p.join(' ') || '0m';
    };
    const tradesWithDuration = closedTrades.filter(t => t.duration);
    const avgDuration = tradesWithDuration.length > 0
      ? tradesWithDuration.reduce((s, t) => s + parseDur(t.duration!), 0) / tradesWithDuration.length : 0;

    // Daily P&L for streak + best/worst
    const dailyPnL = new Map<string, number>();
    closedTrades.forEach(t => dailyPnL.set(t.date, (dailyPnL.get(t.date) || 0) + (t.pnl || 0)));
    const sortedDays = Array.from(dailyPnL.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let currentStreak = 0;
    let streakType: 'win' | 'loss' | 'none' = 'none';
    if (sortedDays.length > 0) {
      const isWin = sortedDays[0].pnl > 0;
      streakType = isWin ? 'win' : 'loss';
      for (const day of sortedDays) {
        if (day.pnl === 0 || (day.pnl > 0) !== isWin) break;
        currentStreak++;
      }
    }

    const allDayPnLs = Array.from(dailyPnL.values());
    const bestDay = allDayPnLs.length > 0 ? Math.max(...allDayPnLs) : 0;
    const worstDay = allDayPnLs.length > 0 ? Math.min(...allDayPnLs) : 0;

    return {
      totalTrades: trades.length, closedTrades: closedTrades.length,
      openTrades: trades.filter(t => t.status === 'open').length,
      totalPnL, winningTrades: winningTrades.length, losingTrades: losingTrades.length,
      winRate, avgWin, avgLoss, profitFactor, expectancy, avgRiskReward,
      tradesWithRR: tradesWithRR.length, avgDuration: fmtDur(avgDuration),
      tradesWithDuration: tradesWithDuration.length, currentStreak, streakType,
      bestDay, worstDay,
    };
  }, [trades]);

  const cumulativePnL = useMemo(() => {
    const closed = trades.filter(t => t.status === 'closed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cum = 0, peak = 0;
    return closed.map(t => {
      cum += t.pnl || 0;
      if (cum > peak) peak = cum;
      return { date: t.date, cumulative: cum, pnl: t.pnl || 0, peak, drawdown: peak - cum };
    });
  }, [trades]);

  const maxDrawdown = useMemo(() => {
    if (cumulativePnL.length === 0) return { value: 0, percentage: 0 };
    let peak = 0, maxDD = 0, maxDDP = 0;
    cumulativePnL.forEach(p => {
      if (p.cumulative > peak) peak = p.cumulative;
      const dd = peak - p.cumulative;
      if (dd > maxDD) { maxDD = dd; maxDDP = peak > 0 ? (dd / peak) * 100 : 0; }
    });
    return { value: maxDD, percentage: maxDDP };
  }, [cumulativePnL]);

  const tradeDistribution = useMemo(() => {
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== undefined);
    if (closed.length === 0) return [];
    const pnls = closed.map(t => t.pnl || 0);
    const min = Math.min(...pnls), max = Math.max(...pnls);
    const range = max - min, bins = 20, size = range / bins;
    return Array.from({ length: bins }, (_, i) => {
      const lo = min + i * size, hi = lo + size;
      return {
        range: `$${lo.toFixed(0)}`,
        count: pnls.filter(p => p >= lo && (i === bins - 1 ? p <= hi : p < hi)).length,
        pnl: (lo + hi) / 2
      };
    });
  }, [trades]);

  const symbolPerformance = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; wins: number }>();
    trades.filter(t => t.status === 'closed').forEach(t => {
      const e = map.get(t.symbol) || { pnl: 0, count: 0, wins: 0 };
      map.set(t.symbol, { pnl: e.pnl + (t.pnl || 0), count: e.count + 1, wins: e.wins + ((t.pnl || 0) > 0 ? 1 : 0) });
    });
    return Array.from(map.entries())
      .map(([symbol, d]) => ({ symbol, pnl: d.pnl, count: d.count, wins: d.wins, winRate: d.count > 0 ? (d.wins / d.count) * 100 : 0, avgPnL: d.pnl / d.count }))
      .sort((a, b) => b.pnl - a.pnl).slice(0, 8);
  }, [trades]);

  const monthlyPerformance = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: number }>();
    trades.filter(t => t.status === 'closed').forEach(t => {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const m = d.toISOString().substring(0, 7);
      const e = map.get(m) || { pnl: 0, trades: 0 };
      map.set(m, { pnl: e.pnl + (t.pnl || 0), trades: e.trades + 1 });
    });
    return Array.from(map.entries())
      .map(([month, d]) => ({ month, pnl: d.pnl, trades: d.trades }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [trades]);

  const dailyPnLData = useMemo(() => {
    const map = new Map<string, number>();
    trades.filter(t => t.status === 'closed').forEach(t => {
      map.set(t.date, (map.get(t.date) || 0) + (t.pnl || 0));
    });
    let cum = 0;
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pnl]) => { cum += pnl; return { date, pnl, cumulative: cum }; });
  }, [trades]);

  /* ═══════════════════════ FORMATTERS ═══════════════════════ */

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  const fmtP = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const pnlC = (v: number) => v >= 0 ? GAIN : LOSS;
  const pnlBg = (v: number) => v >= 0 ? GAIN_DIM : LOSS_DIM;

  const PnlArrow = ({ value }: { value: number }) =>
    value > 0 ? <ArrowUpRight className="w-3 h-3" style={{ color: GAIN }} /> :
    value < 0 ? <ArrowDownRight className="w-3 h-3" style={{ color: LOSS }} /> :
    <Minus className="w-3 h-3" style={{ color: INK_4 }} />;

  const pieData = [
    { name: 'Wins', value: stats.winningTrades, color: GAIN },
    { name: 'Losses', value: stats.losingTrades, color: LOSS }
  ];

  /* ═══════════════════════ RENDER ═══════════════════════ */

  return (
    <div className="space-y-6 relative dash-grain">

      {/* ════════════════ HERO: PORTFOLIO PERFORMANCE ════════════════ */}
      <div
        className="dash-reveal dash-reveal-1 dash-hero-glow relative overflow-hidden rounded-2xl"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 20% 20%, rgba(201,168,76,0.04) 0%, transparent 60%),
                       radial-gradient(ellipse 60% 50% at 80% 80%, ${stats.totalPnL >= 0 ? 'rgba(52,211,153,0.03)' : 'rgba(248,113,113,0.03)'} 0%, transparent 60%),
                       linear-gradient(170deg, rgba(15,20,35,0.9) 0%, rgba(8,12,24,0.7) 100%)`,
          border: `1px solid ${BORDER}`,
        }}
      >
        {/* Decorative lines */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${AMBER}33, transparent)` }} />
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)` }} />

        <div className="relative p-7 sm:p-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            {/* Left: P&L hero */}
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AMBER, boxShadow: `0 0 8px ${AMBER}` }} />
                <span className="text-[10px] font-medium tracking-[0.25em] uppercase" style={{ color: AMBER }}>
                  Portfolio Performance
                </span>
              </div>

              <div className="flex items-baseline gap-4 flex-wrap">
                <span
                  className="font-display text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-none"
                  style={{ color: pnlC(stats.totalPnL) }}
                >
                  {fmtP(stats.totalPnL)}
                </span>
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-md tabular-nums"
                  style={{ color: pnlC(stats.totalPnL), backgroundColor: pnlBg(stats.totalPnL), border: `1px solid ${stats.totalPnL >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}` }}
                >
                  {stats.totalPnL >= 0 ? '+' : ''}{stats.closedTrades > 0 ? ((stats.totalPnL / Math.max(stats.avgWin * stats.winningTrades + stats.avgLoss * stats.losingTrades, 1)) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>

              <div className="flex items-center gap-5 mt-4">
                <span className="text-[11px] tabular-nums" style={{ color: INK_2 }}>
                  {stats.closedTrades} closed &middot; {stats.openTrades} open
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: INK_3 }}>|</span>
                <span className="text-[11px] tabular-nums" style={{ color: stats.bestDay >= 0 ? GAIN_SOFT : INK_2 }}>
                  Best: {fmt(stats.bestDay)}
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: stats.worstDay < 0 ? LOSS_SOFT : INK_2 }}>
                  Worst: {fmt(stats.worstDay)}
                </span>
              </div>
            </div>

            {/* Right: Equity sparkline */}
            {dailyPnLData.length > 1 && (
              <div className="w-full lg:w-64 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyPnLData}>
                    <defs>
                      <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={pnlC(stats.totalPnL)} stopOpacity={0.20}/>
                        <stop offset="100%" stopColor={pnlC(stats.totalPnL)} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="cumulative" stroke={pnlC(stats.totalPnL)} strokeWidth={1.5} fill="url(#heroSpark)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ METRICS STRIP ════════════════ */}
      <div
        className="dash-reveal dash-reveal-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${BORDER}`, background: SURFACE }}
      >
        {[
          { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, sub: `${stats.winningTrades}W · ${stats.losingTrades}L`, color: stats.winRate >= 50 ? GAIN : LOSS },
          { label: 'Profit Factor', value: stats.profitFactor.toFixed(2), sub: stats.profitFactor >= 1.5 ? 'Strong edge' : stats.profitFactor >= 1 ? 'Marginal' : 'Negative', color: stats.profitFactor >= 1.5 ? GAIN : stats.profitFactor >= 1 ? AMBER : LOSS },
          { label: 'Expectancy', value: fmt(stats.expectancy), sub: 'Per trade EV', color: stats.expectancy > 0 ? GAIN : LOSS },
          { label: 'Avg R:R', value: stats.avgRiskReward > 0 ? `1:${stats.avgRiskReward.toFixed(1)}` : '--', sub: `${stats.tradesWithRR} with R:R`, color: stats.avgRiskReward >= 2 ? GAIN : stats.avgRiskReward >= 1 ? AMBER : INK },
          { label: 'Avg Win', value: fmt(stats.avgWin), sub: `${stats.winningTrades} trades`, color: GAIN },
          { label: 'Avg Loss', value: fmt(stats.avgLoss), sub: `${stats.losingTrades} trades`, color: LOSS },
          { label: 'Avg Hold', value: stats.avgDuration, sub: `${stats.tradesWithDuration} trades`, color: INK },
        ].map((m, i) => (
          <div
            key={m.label}
            className="dash-metric group px-4 py-4 flex flex-col gap-1.5 cursor-default"
            style={{ borderRight: i < 6 ? `1px solid ${BORDER_SUBTLE}` : 'none', borderBottom: `1px solid ${BORDER_SUBTLE}` }}
          >
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase transition-colors" style={{ color: INK_4 }}>
              {m.label}
            </span>
            <span className="font-display text-xl tabular-nums tracking-tight transition-colors" style={{ color: m.color }}>
              {m.value}
            </span>
            <span className="text-[10px] tabular-nums" style={{ color: INK_3 }}>{m.sub}</span>
          </div>
        ))}
      </div>

      {/* ════════════════ STREAK · DRAWDOWN · STATUS ════════════════ */}
      <div className="dash-reveal dash-reveal-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Streak */}
        <div className="rounded-xl px-5 py-4 flex items-center justify-between" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div>
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase block mb-1.5" style={{ color: INK_4 }}>Streak</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl tabular-nums" style={{ color: stats.streakType === 'win' ? GAIN : stats.streakType === 'loss' ? LOSS : INK }}>
                {stats.currentStreak > 0 ? stats.currentStreak : '--'}
              </span>
              <span className="text-[11px]" style={{ color: INK_3 }}>
                {stats.streakType === 'win' ? 'winning' : stats.streakType === 'loss' ? 'losing' : ''} days
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: stats.streakType === 'win' ? GAIN_DIM : stats.streakType === 'loss' ? LOSS_DIM : AMBER_DIM }}>
            {stats.streakType === 'win' ? <TrendingUp className="w-4 h-4" style={{ color: GAIN }} /> :
             stats.streakType === 'loss' ? <TrendingDown className="w-4 h-4" style={{ color: LOSS }} /> :
             <Activity className="w-4 h-4" style={{ color: AMBER }} />}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="rounded-xl px-5 py-4 flex items-center justify-between" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div>
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase block mb-1.5" style={{ color: INK_4 }}>Max Drawdown</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl tabular-nums" style={{ color: maxDrawdown.value > 0 ? LOSS : INK }}>
                {fmt(maxDrawdown.value)}
              </span>
              {maxDrawdown.percentage > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums" style={{ color: LOSS, background: LOSS_DIM }}>
                  {maxDrawdown.percentage.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: maxDrawdown.value > 0 ? LOSS_DIM : AMBER_DIM }}>
            <TrendingDown className="w-4 h-4" style={{ color: maxDrawdown.value > 0 ? LOSS : AMBER }} />
          </div>
        </div>

        {/* Session count / Status */}
        <div className="rounded-xl px-5 py-4 flex items-center justify-between" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div>
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase block mb-1.5" style={{ color: INK_4 }}>Total Trades</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl tabular-nums" style={{ color: INK }}>
                {stats.totalTrades}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums" style={{ color: AMBER, background: AMBER_DIM }}>
                {stats.openTrades} open
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: AMBER_DIM }}>
            <Crosshair className="w-4 h-4" style={{ color: AMBER }} />
          </div>
        </div>
      </div>

      {/* ════════════════ EQUITY CURVE ════════════════ */}
      <div
        className="dash-reveal dash-reveal-4 dash-equity-glow rounded-2xl overflow-hidden"
        style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
      >
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: AMBER }} />
            <div>
              <h3 className="text-[13px] font-semibold tracking-wide" style={{ color: INK }}>Equity Curve</h3>
              <p className="text-[10px] mt-0.5" style={{ color: INK_4 }}>Cumulative P&L with daily sessions</p>
            </div>
          </div>
          {cumulativePnL.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: AMBER }} />
                <span className="text-[9px] tracking-wider uppercase" style={{ color: INK_3 }}>Equity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: GAIN, opacity: 0.5 }} />
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: LOSS, opacity: 0.5 }} />
                <span className="text-[9px] tracking-wider uppercase" style={{ color: INK_3 }}>Daily</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-3 py-5">
          {dailyPnLData.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={dailyPnLData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER} stopOpacity={0.12}/>
                    <stop offset="100%" stopColor={AMBER} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} strokeDasharray="none" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} stroke={AXIS} tick={{ fontSize: 10, fill: INK_4 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="cum" tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} stroke={AXIS} tick={{ fontSize: 10, fill: INK_4 }} axisLine={false} tickLine={false} width={52} />
                <YAxis yAxisId="daily" orientation="right" tickFormatter={(v) => `$${v}`} stroke={AXIS} tick={{ fontSize: 10, fill: INK_4 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                  formatter={(value: number, name: string) => [fmtP(value), name === 'cumulative' ? 'Equity' : 'Daily P&L']}
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: 'rgba(201,168,76,0.15)', strokeWidth: 1 }}
                />
                <Bar yAxisId="daily" dataKey="pnl" radius={[2, 2, 0, 0]} maxBarSize={10}>
                  {dailyPnLData.map((e, i) => (
                    <RechartsCell key={i} fill={e.pnl >= 0 ? GAIN : LOSS} fillOpacity={0.45} />
                  ))}
                </Bar>
                <Area yAxisId="cum" type="monotone" dataKey="cumulative" stroke={AMBER} strokeWidth={2} fill="url(#equityFill)" dot={false}
                  activeDot={{ r: 4, fill: AMBER, stroke: 'rgba(8,12,24,0.9)', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center gap-2" style={{ color: INK_4 }}>
              <Clock className="w-6 h-6" style={{ color: INK_4 }} />
              <p className="text-sm">No closed trades yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════ WIN RATE RING · SYMBOL TABLE ════════════════ */}
      <div className="dash-reveal dash-reveal-5 grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Win Rate */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: GAIN }} />
            <h3 className="text-[13px] font-semibold tracking-wide" style={{ color: INK }}>Win / Loss</h3>
          </div>
          <div className="p-5">
            {stats.closedTrades > 0 ? (
              <div className="flex flex-col items-center">
                <div className="relative dash-ring-glow" style={{ width: 200, height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={72} outerRadius={96} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                        {pieData.map((entry, i) => <RechartsCell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-4xl tracking-tight" style={{ color: INK }}>{stats.winRate.toFixed(1)}%</span>
                    <span className="text-[9px] tracking-[0.2em] uppercase mt-0.5" style={{ color: INK_4 }}>Win Rate</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-3">
                  {[{ label: 'wins', val: stats.winningTrades, c: GAIN }, { label: 'losses', val: stats.losingTrades, c: LOSS }].map(x => (
                    <div key={x.label} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: x.c }} />
                      <span className="text-[11px] tabular-nums" style={{ color: INK_2 }}>{x.val} {x.label}</span>
                    </div>
                  ))}
                </div>
                {/* Avg Win vs Loss bar */}
                <div className="w-full mt-6 space-y-3 px-1">
                  {[
                    { label: 'Avg Win', val: stats.avgWin, c: GAIN, pct: stats.avgWin + stats.avgLoss > 0 ? (stats.avgWin / (stats.avgWin + stats.avgLoss)) * 100 : 50 },
                    { label: 'Avg Loss', val: stats.avgLoss, c: LOSS, pct: stats.avgWin + stats.avgLoss > 0 ? (stats.avgLoss / (stats.avgWin + stats.avgLoss)) * 100 : 50 },
                  ].map(x => (
                    <div key={x.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] tracking-[0.15em] uppercase" style={{ color: INK_4 }}>{x.label}</span>
                        <span className="text-[12px] tabular-nums font-medium" style={{ color: x.c }}>{fmt(x.val)}</span>
                      </div>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${x.pct}%`, background: x.c, opacity: 0.7 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center" style={{ color: INK_4 }}><p className="text-sm">No closed trades</p></div>
            )}
          </div>
        </div>

        {/* Symbol Performance */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden dash-scroll" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: AMBER }} />
            <h3 className="text-[13px] font-semibold tracking-wide" style={{ color: INK }}>Instruments</h3>
          </div>
          <div className="overflow-x-auto">
            {symbolPerformance.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
                    {['Symbol', 'Trades', 'Win %', 'P&L', 'Avg P&L'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[9px] font-semibold tracking-[0.2em] uppercase" style={{ color: INK_4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {symbolPerformance.map((sym, i) => (
                    <tr key={sym.symbol} className="dash-table-row" style={{ borderBottom: i < symbolPerformance.length - 1 ? `1px solid ${BORDER_SUBTLE}` : 'none' }}>
                      <td className="px-5 py-3">
                        <span className="text-[12px] font-semibold tracking-wide" style={{ color: AMBER }}>{sym.symbol}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] tabular-nums" style={{ color: INK_2 }}>{sym.count}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="h-full rounded-full" style={{ width: `${sym.winRate}%`, background: sym.winRate >= 50 ? GAIN : LOSS, opacity: 0.7 }} />
                          </div>
                          <span className="text-[11px] tabular-nums" style={{ color: sym.winRate >= 50 ? GAIN : LOSS }}>{sym.winRate.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <PnlArrow value={sym.pnl} />
                          <span className="text-[11px] tabular-nums font-medium" style={{ color: pnlC(sym.pnl) }}>{fmt(Math.abs(sym.pnl))}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] tabular-nums" style={{ color: pnlC(sym.avgPnL) }}>{fmt(sym.avgPnL)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-56 flex items-center justify-center" style={{ color: INK_4 }}><p className="text-sm">No instrument data</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ MONTHLY · DISTRIBUTION ════════════════ */}
      <div className="dash-reveal dash-reveal-6 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Monthly */}
        {monthlyPerformance.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: AMBER }} />
              <h3 className="text-[13px] font-semibold tracking-wide" style={{ color: INK }}>Monthly Returns</h3>
            </div>
            <div className="px-3 py-5">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyPerformance} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="none" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={(v) => { const m = parseInt(v.split('-')[1]); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] || v; }} stroke={AXIS} tick={{ fontSize: 10, fill: INK_4 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} stroke={AXIS} tick={{ fontSize: 10, fill: INK_4 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(value: number) => [fmtP(value), 'P&L']} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,168,76,0.04)' }}
                    labelFormatter={(v) => { const [y, m] = v.split('-'); return `${['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(m) - 1]} ${y}`; }} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {monthlyPerformance.map((e, i) => <RechartsCell key={i} fill={e.pnl >= 0 ? GAIN : LOSS} fillOpacity={0.7} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Distribution */}
        {tradeDistribution.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: AMBER }} />
              <div>
                <h3 className="text-[13px] font-semibold tracking-wide" style={{ color: INK }}>P&L Distribution</h3>
                <p className="text-[10px] mt-0.5" style={{ color: INK_4 }}>Return histogram across closed trades</p>
              </div>
            </div>
            <div className="px-3 py-5">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={tradeDistribution} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="none" vertical={false} />
                  <XAxis dataKey="range" stroke={AXIS} tick={{ fontSize: 9, fill: INK_4 }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis stroke={AXIS} tick={{ fontSize: 10, fill: INK_4 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip formatter={(value: number) => [value, 'Trades']} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,168,76,0.04)' }} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={16}>
                    {tradeDistribution.map((e, i) => <RechartsCell key={i} fill={e.pnl >= 0 ? GAIN : LOSS} fillOpacity={0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════ JOURNAL · CALENDAR ════════════════ */}
      <JournalAnalysisCard onNavigateToJournal={onNavigateToJournal} />
      <CalendarView trades={trades} />
    </div>
  );
}
