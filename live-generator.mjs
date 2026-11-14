// Isolated V3 live generator. Runs only in the separate test repository.
import fs from 'node:fs';
import {getShutdownsData,selectScheduleDays,kyivDate} from './src/source.js';
import {loadWeather,weatherForDate} from './src/weather.js';
import {gardenTip,sowingAdvice} from './src/garden.js';
import {lunarForDate} from './src/moon.js';
import {astroForMoon} from './src/astro.js';
import {buildCardV3Html} from './src/card-v3.js';
const now=new Date(),date=kyivDate(now),generatedAt=now.toISOString();
const result={generatedAt,date,group:'1.1',live:false,source:null,error:null,periods:[],weather:null,garden:null,moon:null,astro:null};
const pad=n=>String(n).padStart(2,'0');
const clock=m=>pad(Math.floor(m/60))+':'+pad(m%60);
function scheduleForDay(states){
  if(!states)throw Error('Група GPV1.1 відсутня');
  const slots=[];
  for(let h=0;h<24;h++){
    const v=states[h+1]??states[String(h+1)];
    if(!['yes','no','first','second'].includes(v))throw Error('Невідомий стан години '+(h+1));
    const pair=v==='yes'?[true,true]:v==='no'?[false,false]:v==='first'?[false,true]:[true,false];
    slots.push(...pair);
  }
  const periods=[];
  for(let i=0;i<48;i++){
    const on=slots[i],start=i*30,end=start+30,last=periods.at(-1);
    if(last&&last.power===on&&last.end===clock(start))last.end=clock(end);
    else periods.push({begin:clock(start),end:clock(end),power:on});
  }
  if(periods[0]?.begin!=='00:00'||periods.at(-1)?.end!=='24:00')throw Error('Неповне покриття доби');
  return periods;
}
try{
  const {fact,source}=await getShutdownsData();
  const day=selectScheduleDays(fact,now).find(x=>x.date===date);
  if(!day)throw Error('ДТЕК не надав графік на поточну дату');
  result.periods=scheduleForDay(fact.data[day.key]?.GPV1_1 ?? fact.data[day.key]?.['GPV1.1']);
  // DTEK uses GPV1.1, not a display-only "1.1" label.
  result.source=source;result.live=true;result.sourceUpdated=String(fact.update??'');
}catch(error){result.error=String(error.message);console.error('LIVE DTEK unavailable:',result.error)}
try{
  const snapshot=await loadWeather({now});
  result.weather=weatherForDate(snapshot,date,now);
  if(!result.weather||result.weather.stale)throw Error('Прогноз погоди застарів');
}catch(error){result.weather=null;result.weatherError=String(error.message)}
try{
  result.moon=lunarForDate(date);
  result.astro=astroForMoon(result.moon,date);
  result.garden={tip:gardenTip(date,result.weather),...sowingAdvice(date,result.weather,result.moon)};
}catch(error){result.infoError=String(error.message)}
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/svitlopuls-live.json',JSON.stringify(result,null,2));
const details={schedule:result.periods,date,label:'сьогодні',update:result.sourceUpdated??'',source:result.source??'НЕМАЄ АКТУАЛЬНИХ ДАНИХ',now,weather:result.weather};
let html='';
if(result.live){
  html=buildCardV3Html(details);
}else{
  // Never render the old demo schedule as today's DTEK data.
  html='<html lang="uk"><head><meta charset="utf-8"></head><body style="background:#04140b;color:white;font:22px Arial;padding:28px"><h1>Світлопульс 3.0 — тест</h1><p>Актуальний графік ДТЕК недоступний. Дані не відображаються, щоб уникнути помилкових відключень.</p></body></html>';
}
const warning='<div id="trial-status" style="background:#4d170d;color:white;text-align:center;padding:9px;font:700 16px Arial">ТЕСТОВА КАРТКА · '+(result.live?'ДТЕК: '+result.source:'ГРАФІК НЕДОСТУПНИЙ')+' · Telegram не змінюється</div>';
html=html.replace('<body>','<body>'+warning);
html=html.replace('</head>',`<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0!important;max-width:100%;overflow-x:auto!important}#trial-shell{width:100%;overflow:auto}#trial-card{width:1404px;transform-origin:top left}</style></head>`);
html=html.replace(warning,warning+'<div id="trial-tools" style="position:sticky;top:0;background:#072319;color:white;z-index:9999;padding:8px;text-align:center"><button id="minus">−</button> <button id="fit">За шириною</button> <button id="plus">+</button> <output id="percent"></output></div><div id="trial-shell"><div id="trial-card">');
html=html.replace('</body>',`</div></div><script>
(function(){
const el=document.getElementById('trial-card'),out=document.getElementById('percent'),shell=document.getElementById('trial-shell');let scale=1;
function apply(n){scale=Math.max(.2,Math.min(2,n));el.style.transform='scale('+scale+')';shell.style.height=Math.ceil(el.scrollHeight*scale)+'px';el.parentElement.style.width=Math.ceil(1404*scale)+'px';out.textContent=' '+Math.round(scale*100)+'%';}
function fit(){apply(Math.min(1,innerWidth/1404));}
document.getElementById('minus').onclick=()=>apply(scale-.1);
document.getElementById('plus').onclick=()=>apply(scale+.1);
document.getElementById('fit').onclick=fit;fit();
const generated=Date.parse('${generatedAt}');
setInterval(()=>{if(Date.now()-generated>12*60*1000){document.getElementById('trial-status').textContent='⚠️ ТЕСТ: дані застаріли — перевірте оновлення GitHub Actions';}},30000);
setInterval(async()=>{try{const r=await fetch('svitlopuls-live.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const j=await r.json();if(j.generatedAt!=='${generatedAt}')location.reload();}catch(e){}},60000);
})();</script></body>`);
fs.writeFileSync('dist/index.html',html);
console.log(JSON.stringify({date,live:result.live,periods:result.periods.length,weather:!!result.weather,moon:!!result.moon,error:result.error}));
