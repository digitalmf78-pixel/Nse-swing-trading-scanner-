import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateFundamentalProfile, type FundamentalProfile } from '../research/fundamental_pilot/fundamental_profile.ts';

export interface CachedValidatedProfile {
  profileHash: string;
  savedAtUtc: string;
  profile: FundamentalProfile;
}
export interface NseValidatedFundamentalCache {
  schemaVersion: 1;
  updatedAtUtc: string;
  symbols: Record<string, { symbol: string; profiles: CachedValidatedProfile[] }>;
}

function defaultPath(): string {
  return path.join(process.cwd(), 'data', 'research', 'nse_validated_fundamentals.json');
}
function hashProfile(profile: FundamentalProfile): string {
  return createHash('sha256').update(JSON.stringify(profile)).digest('hex');
}
export function loadNseValidatedFundamentalCache(file = defaultPath()): NseValidatedFundamentalCache {
  if (!fs.existsSync(file)) return { schemaVersion: 1, updatedAtUtc: '', symbols: {} };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<NseValidatedFundamentalCache>;
  if (parsed.schemaVersion !== 1 || !parsed.symbols || typeof parsed.symbols !== 'object' || Array.isArray(parsed.symbols)) {
    throw new Error('NSE validated fundamental cache schema invalid; refusing to overwrite');
  }
  for (const [symbol, entry] of Object.entries(parsed.symbols)) {
    if (symbol !== symbol.trim().toUpperCase() || !entry || entry.symbol !== symbol || !Array.isArray(entry.profiles)) {
      throw new Error(`NSE validated fundamental cache issuer entry invalid: ${symbol}`);
    }
    for (const item of entry.profiles) {
      if (!item || !item.profile || item.profile.symbol !== symbol || !/^[a-f0-9]{64}$/.test(item.profileHash)
          || hashProfile(item.profile) !== item.profileHash || validateFundamentalProfile(item.profile).length) {
        throw new Error(`NSE validated fundamental cache profile integrity failed: ${symbol}`);
      }
    }
  }
  return { schemaVersion: 1, updatedAtUtc: parsed.updatedAtUtc ?? '', symbols: parsed.symbols };
}
function atomicSave(cache: NseValidatedFundamentalCache, file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Append-only store for issuer profiles that pass the complete provenance validator.
 * Conflicting periods/revisions are retained side-by-side; this module deliberately
 * does not choose a winning revision or expose a scanner-facing "current" value.
 */
export function appendValidatedNseFundamentalProfile(
  profile: FundamentalProfile,
  options: { cacheFile?: string; now?: () => Date } = {},
): { saved: boolean; profileHash: string; profilesForSymbol: number } {
  const issues = validateFundamentalProfile(profile);
  if (issues.length) throw new Error(`Fundamental profile rejected: ${issues.map(x => `${x.path}:${x.code}`).join(', ')}`);
  if (!Object.values(profile.metrics).some(metric => metric.status === 'VALIDATED')) {
    throw new Error('Fundamental profile has no validated metrics; nothing to persist');
  }
  const symbol = profile.symbol.trim().toUpperCase();
  if (symbol !== profile.symbol) throw new Error('Fundamental profile symbol must already be normalized to uppercase');
  const file = options.cacheFile ?? defaultPath();
  const cache = loadNseValidatedFundamentalCache(file);
  const profileHash = hashProfile(profile);
  const entry = cache.symbols[symbol] ?? { symbol, profiles: [] };
  if (entry.profiles.some(item => item.profileHash === profileHash)) {
    return { saved: false, profileHash, profilesForSymbol: entry.profiles.length };
  }
  const savedAtUtc = (options.now?.() ?? new Date()).toISOString();
  entry.profiles.push({ profileHash, savedAtUtc, profile });
  cache.symbols[symbol] = entry;
  cache.updatedAtUtc = savedAtUtc;
  atomicSave(cache, file);
  return { saved: true, profileHash, profilesForSymbol: entry.profiles.length };
}
