import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const updater = path.join(repoRoot, 'scripts', 'update-delivery-dashboard.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nse-delivery-dry-run-'));
try {
  const run = spawnSync(process.execPath, [updater], {
    cwd: tempRoot,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 8 * 1024 * 1024
  });
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error('Isolated updater exited with status ' + run.status);
  const output = path.join(tempRoot, 'docs', 'data', 'latest.json');
  if (!fs.existsSync(output)) throw new Error('Isolated updater did not create latest.json');
  const data = JSON.parse(fs.readFileSync(output, 'utf8'));
  if ((data.sessionDates || []).length !== 5) throw new Error('Expected five validated sessions');
  if (data.deliveryCycle?.windowCalendarDays !== 30 || data.deliveryCycle?.gate !== 'CYCLE_A_OR_CYCLE_B') throw new Error('30-day delivery cycle metadata is missing');
  if ((data.deliveryCycle?.sessionsChecked || 0) < 5) throw new Error('Insufficient historical sessions for 30-day cycle evaluation');
  if (data.freshnessStatus !== 'FRESH') throw new Error('Latest EOD session is not marked FRESH');
  if (!['READY', 'READY_WITH_WARNINGS'].includes(data.status)) throw new Error('Unexpected updater status: ' + data.status);
  for (const stock of data.stocks || []) {
    if (!stock.deliveryCycle30d || typeof stock.deliveryCycle30d.cycleA !== 'boolean' || typeof stock.deliveryCycle30d.cycleB !== 'boolean' || stock.deliveryCycle30d.deliveryCyclePass !== (stock.deliveryCycle30d.cycleA || stock.deliveryCycle30d.cycleB)) {
      throw new Error('Invalid 30-day A/B cycle result for ' + stock.symbol);
    }
    if (stock.fiveSessionDeliveryPct?.length !== 5 || !stock.fiveSessionDeliveryPct.every(v => Number.isFinite(v) && v >= 60)) {
      throw new Error('Invalid five-session delivery data for ' + stock.symbol);
    }
    if (data.mainBoardStatus === 'VERIFIED' && stock.mainBoardStatus !== 'VERIFIED') {
      throw new Error('Unverified Main Board row leaked into verified output: ' + stock.symbol);
    }
  }
  console.log(JSON.stringify({
    result: 'ISOLATED_DRY_RUN_PASS',
    status: data.status,
    latestSession: data.latestSession,
    sessionDates: data.sessionDates,
    mainBoardStatus: data.mainBoardStatus,
    qualifiedStocks: data.stocks.length,
    lowVolumeReviewCount: data.lowVolumeReviewCount,
    cycleWindow: data.deliveryCycle,
    cycleGatePassCount: data.stocks.filter(s => s.deliveryCycle30d.deliveryCyclePass).length,
    outputWasTemporary: true
  }));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
