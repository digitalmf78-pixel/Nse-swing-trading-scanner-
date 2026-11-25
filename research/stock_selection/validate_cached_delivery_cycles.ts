import fs from 'node:fs';
import path from 'node:path';
import { countConsecutiveQualifyingRolling5SessionWindows } from './swing_tier_policy.ts';
const root = process.cwd();
const sessionsDir = path.join(root, 'data/cache/bhavcopy-200d/sessions');
const calendar = JSON.parse(fs.readFileSync(path.join(root, 'data/inputs/nse_trading_calendar.json'), 'utf8'));
const status = JSON.parse(fs.readFileSync(path.join(root, 'data/cache/bhavcopy-200d/status.json'), 'utf8'));
function iso(name: string): string | null { const m=name.match(/^sec_bhavdata_full_(\d{2})(\d{2})(\d{4})\.csv$/); return m ? m[3]+'-'+m[2]+'-'+m[1] : null; }
function addDays(s: string,n: number): string { const d=new Date(s+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function isSession(s: string): boolean { const y=calendar.years[s.slice(0,4)]; if(!y) throw new Error('Missing NSE calendar year '+s.slice(0,4)); if(y.special_sessions && y.special_sessions[s]) return true; const day=new Date(s+'T00:00:00Z').getUTCDay(); return day!==0 && day!==6 && !(y.holidays||[]).includes(s); }
function readEq(file: string): Map<string, number | null> { const lines=fs.readFileSync(file,'utf8').trim().split(/\r?\n/); const h=lines[0].split(',').map(x=>x.trim().toUpperCase()); const si=h.indexOf('SYMBOL'), ri=h.indexOf('SERIES'), di=h.indexOf('DELIV_PER'); if(si<0||ri<0||di<0) throw new Error('Bhavcopy schema invalid: '+file); const map=new Map(); for(const line of lines.slice(1)){ const c=line.split(','); if(c[ri].trim()!=='EQ') continue; const sym=c[si].trim(); const raw=c[di].trim(); const parsed=raw===''||raw==='-'?null:Number(raw); const v=parsed!==null&&Number.isFinite(parsed)&&parsed>=0&&parsed<=100?parsed:null; map.set(sym,v); } return map; }
if(status.status!=='READY'||status.expectedSessions!==200||status.availableSessions!==200||(status.missingSessions||[]).length) throw new Error('200-session official NSE cache is not complete/READY');
const files=fs.readdirSync(sessionsDir).map(name=>({name,date:iso(name)})).filter((x): x is {name: string; date: string} => x.date !== null).sort((a,b)=>a.date.localeCompare(b.date));
if(files.length<21) throw new Error('Fewer than 21 cached NSE sessions');
const latest=files[files.length-1].date; if(latest!==status.latestCachedSession) throw new Error('Latest session filename and cache status disagree');
const start=addDays(latest,-29); const dates=[]; for(let d=start;d<=latest;d=addDays(d,1)) if(isSession(d)) dates.push(d);
if(dates.length!==21) throw new Error('Expected 21 sessions in 30-day window, found '+dates.length);
const fileMap=new Map(files.map(x=>[x.date,path.join(sessionsDir,x.name)])); const missing=dates.filter(d=>!fileMap.has(d)); if(missing.length) throw new Error('Missing expected NSE sessions: '+missing.join(','));
const maps=dates.map(d=>readEq(fileMap.get(d))); const universe=Array.from(maps[20].keys());
let complete=0,incomplete=0,invalid=0,a=0,b=0,both=0,either=0,neither=0;
for(const sym of universe){ const values=maps.map(m=>m.has(sym)?m.get(sym):null); const valid=values.filter(v=>v!==null).length; if(valid===21) complete++; else incomplete++; invalid+=21-valid; const pa=countConsecutiveQualifyingRolling5SessionWindows(values,60)>=5; const pb=values.filter(v=>v!==null&&v>=60&&v<=100).length>=5; if(pa)a++; if(pb)b++; if(pa&&pb)both++; if(pa||pb)either++; else neither++; }
console.log(JSON.stringify({result:'PASS',source:'Committed official NSE sec_bhavdata_full EQ Bhavcopy cache',latestSession:latest,window:{startDate:start,endDate:latest,calendarDays:30,expectedSessions:dates.length,sessionsChecked:maps.length,missingSessions:missing},universe:{latestSessionEqSymbols:universe.length,complete21SessionHistory:complete,incompleteHistory:incomplete,invalidOrMissingObservations:invalid},deliveryGate:{thresholdPct:60,cycleA:'5 consecutive qualifying rolling 5-session windows',cycleB:'at least 5 valid individual sessions at >=60%',cycleAPass:a,cycleBPass:b,bothPass:both,eitherPass:either,neitherPass:neither},note:'Validates cached delivery A/B only; not EMA/RVOL/price-action tier classification.'},null,2));
