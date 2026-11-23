import type {
  BacktestResult,
  BacktestSignalScope,
  BacktestStopMode,
  BacktestTrade,
  DailyBhavRow,
  DeliveryCategory,
} from '../src/types/trading.ts';
import { nsePipeline } from './nsePipeline.ts';

interface MergedBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delivPer: number | null;
  delivQty: number | null;
  deliveryCategory: DeliveryCategory | 'UNVERIFIED_6M';
  ema21: number | null;
  atr14: number | null;
  rvol20: number | null;
  prior20High: number | null;
  prior10High: number | null;
}

function computeEma21(closes: number[]): Array<number | null> {
  const out: Array<number | null> = new Array(closes.length).fill(null);
  if (closes.length < 21) return out;
  const k = 2 / 22;
  let ema = closes.slice(0, 21).reduce((a, b) => a + b, 0) / 21;
  out[20] = ema;
  for (let i = 21; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function computeAtr14Series(bars: Array<{ high: number; low: number; close: number }>): Array<number | null> {
  const out: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length < 15) return out;
  const trs: number[] = [bars[0].high - bars[0].low];
  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i];
    const prevClose = bars[i - 1].close;
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prevClose),
      Math.abs(curr.low - prevClose)
    );
    trs.push(tr);
  }
  let atr = trs.slice(1, 15).reduce((a, b) => a + b, 0) / 14;
  out[14] = atr;
  for (let i = 15; i < trs.length; i++) {
    atr = (atr * 13 + trs[i]) / 14;
    out[i] = atr;
  }
  return out;
}

function resolveRollingDeliveryCategory(
  delivBars: Array<{ date: string; delivPer: number | null }>,
  idx: number
): DeliveryCategory | 'UNVERIFIED_6M' {
  const current = delivBars[idx];
  if (current.delivPer === null) return 'UNVERIFIED_6M';

  const currMs = Date.parse(`${current.date}T00:00:00Z`);
  const cutoffMs = currMs - 29 * 24 * 60 * 60 * 1000;
  const window = delivBars
    .slice(0, idx + 1)
    .filter((b) => b.delivPer !== null && Date.parse(`${b.date}T00:00:00Z`) >= cutoffMs);

  if (window.length < 5) {
    // Early Bhavcopy window: use single-session >= 60% institutional delivery threshold
    return current.delivPer >= 60 ? 'B_ONLY' : 'NONE';
  }

  let dailyGt60 = 0;
  let rolling5dGt60 = 0;
  for (let i = 0; i < window.length; i++) {
    if ((window[i].delivPer ?? 0) >= 60) dailyGt60++;
    if (i >= 4) {
      const avg5 =
        ((window[i - 4].delivPer ?? 0) +
          (window[i - 3].delivPer ?? 0) +
          (window[i - 2].delivPer ?? 0) +
          (window[i - 1].delivPer ?? 0) +
          (window[i].delivPer ?? 0)) /
        5;
      if (avg5 >= 60) rolling5dGt60++;
    }
  }

  const passA = rolling5dGt60 >= 5;
  const passB = dailyGt60 >= 5;
  if (passA && passB) return 'A_AND_B';
  if (passA) return 'A_ONLY';
  if (passB) return 'B_ONLY';
  // If rolling count hasn't reached 5 days yet (e.g. sessions 5-12 of cached window), allow strong 5D avg >= 60%
  if (window.length < 12 && rolling5dGt60 >= 2 && current.delivPer >= 55) return 'B_ONLY';
  return 'NONE';
}

export async function runStockDeliveryBacktest(
  symbol: string,
  options?: {
    holdDays?: number;
    targetR?: number;
    stopMode?: BacktestStopMode;
    signalScope?: BacktestSignalScope;
  }
): Promise<BacktestResult> {
  const detail = nsePipeline.getStockDetail(symbol);
  if (!detail) {
    throw new Error(`Symbol ${symbol.toUpperCase()} not found in NSE Mainboard dataset.`);
  }

  const sym = detail.summary.symbol;
  const holdDays = Math.min(30, Math.max(3, Math.round(options?.holdDays ?? 10)));
  const targetR = Math.min(5, Math.max(1, Number((options?.targetR ?? 2).toFixed(1))));
  const stopMode: BacktestStopMode =
    options?.stopMode === 'PCT_5' || options?.stopMode === 'PCT_7' ? options.stopMode : 'ATR_1_5';
  const signalScope: BacktestSignalScope =
    options?.signalScope === 'DELIV_AB_ONLY' ? 'DELIV_AB_ONLY' : 'ALL_6M';

  const localBhavMap = new Map<string, DailyBhavRow>();
  for (const row of detail.history) {
    if (row.close !== null) {
      localBhavMap.set(row.date, row);
    }
  }

  // Backtests use only exact NSE Bhavcopy OHLCV and delivery data.
  // Missing Bhavcopy sessions are not filled from a non-NSE price provider.
  const rawBars = Array.from(localBhavMap.values())
    .filter((row) => row.close !== null)
    .map((row) => {
      const close = row.close as number;
      return {
        date: row.date,
        open: row.open ?? close,
        high: row.high ?? close,
        low: row.low ?? close,
        close,
        volume: row.volume,
        delivPer: row.delivPer,
        delivQty: row.delivQty,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const closes = rawBars.map((b) => b.close);
  const ema21Arr = computeEma21(closes);
  const atr14Arr = computeAtr14Series(rawBars);

  const bars: MergedBar[] = rawBars.map((b, i) => {
    let rvol20: number | null = null;
    let prior20High: number | null = null;
    let prior10High: number | null = null;

    if (i >= 20) {
      const prev20 = rawBars.slice(i - 20, i);
      const avgVol20 = prev20.reduce((s, p) => s + p.volume, 0) / 20;
      if (avgVol20 > 0) rvol20 = b.volume / avgVol20;
      prior20High = Math.max(...prev20.map((p) => p.high));
    }
    if (i >= 10) {
      const prev10 = rawBars.slice(i - 10, i);
      prior10High = Math.max(...prev10.map((p) => p.high));
    }

    return {
      ...b,
      deliveryCategory: resolveRollingDeliveryCategory(rawBars, i),
      ema21: ema21Arr[i],
      atr14: atr14Arr[i],
      rvol20,
      prior20High,
      prior10High,
    };
  });

  // Reference logged signals from data/signal_history/signal_log.csv
  const loggedSignalsByDate = new Set(
    detail.signals
      .filter(
        (s) =>
          (s.deliveryCategory === 'A_AND_B' ||
            s.deliveryCategory === 'A_ONLY' ||
            s.deliveryCategory === 'B_ONLY') &&
          (s.setupType === 'Breakout' || s.setupType === 'Pre-Breakout')
      )
      .map((s) => s.eodDate)
  );

  const latestDate = bars[bars.length - 1]?.date || detail.summary.latestDate;
  const evalCutoffMs = Date.parse(`${latestDate}T00:00:00Z`) - 183 * 24 * 60 * 60 * 1000;
  const evalBars = bars.filter((b) => Date.parse(`${b.date}T00:00:00Z`) >= evalCutoffMs);
  const evalFromDate = evalBars[0]?.date || latestDate;
  const nseDeliverySessions = evalBars.filter((b) => b.delivPer !== null).length;

  const trades: BacktestTrade[] = [];
  let nextAllowedSignalIdx = 0;
  let equityFactor = 1.0;
  let peakEquity = 1.0;
  let maxDrawdownPct = 0;
  let cumR = 0;

  for (let i = 20; i < bars.length - 1; i++) {
    if (i < nextAllowedSignalIdx) continue;
    const b = bars[i];
    if (Date.parse(`${b.date}T00:00:00Z`) < evalCutoffMs) continue;

    const ema21 = b.ema21;
    const rvol = b.rvol20;
    const prior20High = b.prior20High;
    const prior10High = b.prior10High;
    if (ema21 === null || rvol === null || prior20High === null || prior10High === null) continue;

    const prevClose = bars[i - 1].close;
    const dayChangePct = prevClose > 0 ? ((b.close - prevClose) / prevClose) * 100 : 0;
    const range = Math.max(b.high - b.low, 0.0001);
    const clv = (b.close - b.low) / range;

    const hasDelivData = b.delivPer !== null;
    const isDelivAB =
      b.deliveryCategory === 'A_AND_B' ||
      b.deliveryCategory === 'A_ONLY' ||
      b.deliveryCategory === 'B_ONLY';
    const isLoggedSignal = loggedSignalsByDate.has(b.date);

    let signalBasis: 'VERIFIED_DELIV_AB' | 'OHLCV_6M_PROXY' | null = null;

    if (hasDelivData) {
      // NSE Bhavcopy covered session: require Delivery A/B qualification (or logged A/B signal) + trend + RVOL breakout
      const breakoutTrigger =
        b.close > ema21 &&
        rvol >= 1.4 &&
        (b.close >= prior20High * 0.995 ||
          (b.close >= prior10High * 0.995 && dayChangePct >= 0.8) ||
          isLoggedSignal);
      if ((isDelivAB || isLoggedSignal) && breakoutTrigger) {
        signalBasis = 'VERIFIED_DELIV_AB';
      }
    } else if (signalScope === 'ALL_6M') {
      // Earlier 6M Yahoo OHLCV session: strict price-volume breakout proxy (20D high breakout + RVOL >= 1.5 + strong close > EMA21)
      const proxyBreakout =
        b.close > ema21 &&
        rvol >= 1.5 &&
        b.close > prior20High &&
        dayChangePct >= 1.0 &&
        clv >= 0.55;
      if (proxyBreakout) {
        signalBasis = 'OHLCV_6M_PROXY';
      }
    }

    if (!signalBasis) continue;
    if (signalScope === 'DELIV_AB_ONLY' && signalBasis !== 'VERIFIED_DELIV_AB') continue;

    // Enter at next session Open (lookahead-free)
    const entryIdx = i + 1;
    const entryBar = bars[entryIdx];
    const entryPrice = entryBar.open > 0 ? entryBar.open : b.close;

    let stopLoss: number;
    if (stopMode === 'PCT_5') {
      stopLoss = entryPrice * 0.95;
    } else if (stopMode === 'PCT_7') {
      stopLoss = entryPrice * 0.93;
    } else {
      const atr = b.atr14 ?? entryPrice * 0.035;
      const rawStop = entryPrice - 1.5 * atr;
      const maxCapStop = entryPrice * 0.92; // V8 8% max stop guard
      stopLoss = Math.max(rawStop, maxCapStop);
    }

    const riskPerShare = Math.max(entryPrice - stopLoss, entryPrice * 0.01);
    const stopPct = (riskPerShare / entryPrice) * 100;
    const targetPrice = entryPrice + targetR * riskPerShare;

    const maxEndIdx = Math.min(entryIdx + holdDays - 1, bars.length - 1);
    let exitIdx = maxEndIdx;
    let exitPrice = bars[maxEndIdx].close;
    let outcome: BacktestTrade['outcome'] =
      maxEndIdx - entryIdx + 1 < holdDays ? 'OPEN' : 'TIME_EXIT';
    let maxHigh = entryPrice;
    let minLow = entryPrice;

    for (let j = entryIdx; j <= maxEndIdx; j++) {
      const bar = bars[j];
      if (bar.high > maxHigh) maxHigh = bar.high;
      if (bar.low < minLow) minLow = bar.low;

      // Conservative intraday check: stop hit takes precedence over target hit on same bar
      if (bar.low <= stopLoss) {
        exitIdx = j;
        exitPrice = stopLoss;
        outcome = 'STOP_HIT';
        break;
      }
      if (bar.high >= targetPrice) {
        exitIdx = j;
        exitPrice = targetPrice;
        outcome = 'TARGET_HIT';
        break;
      }
    }

    const rawReturnPct = ((exitPrice - entryPrice) / entryPrice) * 100;
    const returnPct = Number((rawReturnPct - 0.4).toFixed(2)); // 0.4% round-trip transaction cost
    const realizedR = Number((((exitPrice - entryPrice) / riskPerShare) - (0.4 / (stopPct || 1))).toFixed(2));
    const mfePct = ((maxHigh - entryPrice) / entryPrice) * 100;
    const maePct = ((minLow - entryPrice) / entryPrice) * 100;
    const barsHeld = exitIdx - entryIdx + 1;

    if (outcome !== 'OPEN') {
      equityFactor *= 1 + returnPct / 100;
      if (equityFactor > peakEquity) peakEquity = equityFactor;
      const dd = ((peakEquity - equityFactor) / peakEquity) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      cumR += realizedR;
    }

    trades.push({
      id: trades.length + 1,
      signalDate: b.date,
      entryDate: entryBar.date,
      exitDate: bars[exitIdx].date,
      signalBasis,
      deliveryCategory: b.deliveryCategory,
      delivPer: b.delivPer,
      rvol: Number(rvol.toFixed(2)),
      entryPrice: Number(entryPrice.toFixed(2)),
      stopLoss: Number(stopLoss.toFixed(2)),
      targetPrice: Number(targetPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
      stopPct: Number(stopPct.toFixed(2)),
      outcome,
      returnPct: Number(returnPct.toFixed(2)),
      realizedR: Number(realizedR.toFixed(2)),
      mfePct: Number(mfePct.toFixed(2)),
      maePct: Number(maePct.toFixed(2)),
      barsHeld,
      cumReturnPct: Number(((equityFactor - 1) * 100).toFixed(2)),
      cumR: Number(cumR.toFixed(2)),
    });

    // Enforce single active position per stock + 2-bar cooldown
    nextAllowedSignalIdx = exitIdx + 2;
  }

  const closed = trades.filter((t) => t.outcome !== 'OPEN');
  const openTrades = trades.length - closed.length;
  const winTrades = closed.filter((t) => t.realizedR > 0);
  const lossTrades = closed.filter((t) => t.realizedR <= 0);

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const winRatePct = closed.length > 0 ? (winTrades.length / closed.length) * 100 : null;
  const avgWinPct = avg(winTrades.map((t) => t.returnPct));
  const avgLossPct = avg(lossTrades.map((t) => t.returnPct));
  const avgWinR = avg(winTrades.map((t) => t.realizedR));
  const avgLossR = avg(lossTrades.map((t) => t.realizedR));

  const avgRiskRewardRatio =
    avgWinR !== null && avgLossR !== null && avgLossR < 0
      ? Number((avgWinR / Math.abs(avgLossR)).toFixed(2))
      : avgWinR !== null && lossTrades.length === 0 && closed.length > 0
        ? Number(avgWinR.toFixed(2))
        : null;

  const expectancyR = avg(closed.map((t) => t.realizedR));
  const grossWinR = winTrades.reduce((s, t) => s + t.realizedR, 0);
  const grossLossR = Math.abs(lossTrades.reduce((s, t) => s + t.realizedR, 0));
  const profitFactor =
    closed.length === 0
      ? null
      : grossLossR > 0
        ? Number((grossWinR / grossLossR).toFixed(2))
        : grossWinR > 0
          ? 9.99
          : 0;

  return {
    symbol: sym,
    params: {
      holdDays,
      targetR,
      stopMode,
      signalScope,
    },
    coverage: {
      fromDate: evalFromDate,
      toDate: latestDate,
      totalTradingSessions: evalBars.length,
      nseDeliverySessions,
      sourceLabel: `NSE Bhavcopy Cached only (${nseDeliverySessions} delivery sessions)`,
    },
    metrics: {
      totalSignals: trades.length,
      closedTrades: closed.length,
      openTrades,
      wins: winTrades.length,
      losses: lossTrades.length,
      winRatePct: winRatePct !== null ? Number(winRatePct.toFixed(1)) : null,
      avgWinPct: avgWinPct !== null ? Number(avgWinPct.toFixed(2)) : null,
      avgLossPct: avgLossPct !== null ? Number(avgLossPct.toFixed(2)) : null,
      avgWinR: avgWinR !== null ? Number(avgWinR.toFixed(2)) : null,
      avgLossR: avgLossR !== null ? Number(avgLossR.toFixed(2)) : null,
      avgRiskRewardRatio,
      expectancyR: expectancyR !== null ? Number(expectancyR.toFixed(2)) : null,
      profitFactor,
      compoundedReturnPct:
        closed.length > 0 ? Number(((equityFactor - 1) * 100).toFixed(2)) : null,
      maxDrawdownPct: closed.length > 0 ? Number(maxDrawdownPct.toFixed(2)) : null,
      avgHoldDays:
        closed.length > 0
          ? Number((closed.reduce((s, t) => s + t.barsHeld, 0) / closed.length).toFixed(1))
          : null,
      verifiedDelivSignals: trades.filter((t) => t.signalBasis === 'VERIFIED_DELIV_AB').length,
      proxySignals: trades.filter((t) => t.signalBasis === 'OHLCV_6M_PROXY').length,
    },
    trades: [...trades].reverse(),
  };
}
