import fs from 'node:fs';
import assert from 'node:assert/strict';
const j=JSON.parse(fs.readFileSync('dist/svitlopuls-live.json','utf8'));
const html=fs.readFileSync('dist/index.html','utf8');
const kyivDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kyiv'}).format(new Date());
assert.equal(j.group,'1.1');
assert.equal(j.date,kyivDate,'JSON must refer to current Kyiv date');
assert.ok(Number.isFinite(Date.parse(j.generatedAt)),'Valid generatedAt required');
assert.ok(Math.abs(Date.now()-Date.parse(j.generatedAt))<5*60_000,'Generation timestamp must be fresh');
assert.ok(html.includes('trial-data-freshness'),'HTML must expose JSON freshness');
assert.ok(html.includes('setInterval(tickLive,1000)'),'Countdown must tick each second');
assert.ok(html.includes("cache:'no-store'"),'Polling must bypass cache');
assert.ok(html.includes('svitlopuls-live.json?t='),'HTML must poll live JSON');
assert.ok(html.includes('Europe/Kyiv'),'Countdown must use Kyiv time');
if(j.live){
 assert.equal(j.source==='ДТЕК'||j.source==='резервна копія даних ДТЕК',true,'Unexpected source');
 assert.ok(Array.isArray(j.periods)&&j.periods.length>0,'Schedule required');
 let prev=0;
 for(const p of j.periods){
  const minute=t=>{const m=/^([0-9]{2}):([0-9]{2})$/.exec(t);assert.ok(m,'Invalid HH:MM: '+t);const n=Number(m[1])*60+Number(m[2]);assert.ok(n>=0&&n<=1440);return n};
  const start=minute(p.begin),end=minute(p.end);
  assert.equal(start,prev,'Gap/overlap in schedule');
  assert.ok(end>start,'Nonpositive period');
  assert.equal(typeof p.power,'boolean');
  prev=end;
 }
 assert.equal(prev,1440,'Schedule must cover full day');
 assert.ok(html.includes('v3-clock'),'Rendered card must contain countdown');
 assert.ok(html.includes('v3-weather'),'Rendered card must contain weather');
} else {
 assert.ok(j.error,'Unavailable schedule must include error');
 assert.ok(html.includes('Актуальний графік ДТЕК недоступний'),'Must not show demo schedule as live');
}
for(const field of ['weather','garden','moon','astro'])assert.ok(Object.hasOwn(j,field),'Missing '+field);
if(j.weather)assert.ok(html.includes('v3-weather'),'Weather data not rendered');
console.log('PASS: independent live JSON schema, full day, fresh generation, Kyiv countdown, HTML polling, info blocks');
console.log(JSON.stringify({date:j.date,generatedAt:j.generatedAt,source:j.source,live:j.live,periods:j.periods.length,weather:!!j.weather,garden:!!j.garden,moon:!!j.moon,astro:!!j.astro}));
