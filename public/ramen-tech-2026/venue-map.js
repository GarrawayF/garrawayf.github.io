/* RAMEN TECH venue map. Uses catalog geo data; falls back to a local venue grid if map tiles/library cannot load. */
'use strict';
(()=>{
const D=window.RAMEN_CATALOG;
if(!D)return;
const excluded=new Set(['tbd','private','city','kyushu-venues']);
const rows=D.venues.filter(v=>!excluded.has(v.id));
const located=rows.filter(v=>v.geo&&Number.isFinite(v.geo.lat)&&Number.isFinite(v.geo.lng)&&v.geo.status==='located');
const list=document.getElementById('venue-list');
if(!list||!list.parentElement)return;

const shell=document.createElement('section');
shell.className='venue-map-shell';
shell.id='venue-map';
shell.setAttribute('aria-labelledby','venue-map-title');
shell.innerHTML=`<div class="venue-map-head"><div><p class="venue-map-kicker">VENUE MAP / FUKUOKA</p><p class="venue-map-title" id="venue-map-title">会場を地図から探す。</p></div><p class="venue-map-note">ピンを押すと、その会場のイベントへ。<br>Garraway Fは黄色で表示しています。</p></div><div class="venue-map-stage"><div id="venue-leaflet" aria-label="RAMEN TECH 会場マップ"></div><div id="venue-map-fallback" class="venue-map-fallback"><div class="venue-map-fallback-grid"></div></div></div><div class="venue-map-legend"><span><i class="venue-map-dot gf"></i>Garraway F</span><span><i class="venue-map-dot"></i>イベント会場</span><span><i class="venue-map-dot cowork"></i>コワーキング</span><span>${located.length}会場を位置表示</span></div>`;
list.parentElement.insertBefore(shell,list);

function goVenue(id){
 const select=document.getElementById('venue-select');
 if(select){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('schedule')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 else location.href=`#schedule`;
}
function gm(v){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((v.geo?.address||v.address||v.name)+' 福岡')}`;}
function fallback(){
 const f=document.getElementById('venue-map-fallback');if(!f)return;f.classList.add('visible');
 f.querySelector('.venue-map-fallback-grid').innerHTML=rows.sort((a,b)=>(b.eventCount||0)-(a.eventCount||0)||a.name.localeCompare(b.name,'ja')).map(v=>`<button type="button" data-map-venue="${v.id}" class="${v.id==='garraway'?'gf':''}"><strong>${v.name}</strong><small>${v.area||'福岡'} / ${v.eventCount||0}掲載枠</small></button>`).join('');
}
function markerHTML(v){const gf=v.id==='garraway',cowork=v.roles?.includes('コワーキング');return `<div class="venue-marker${gf?' gf':cowork?' cowork':''}"><span>${gf?'GF':Math.max(1,Math.min(99,v.eventCount||1))}</span></div>`;}
function init(){
 if(!window.L){fallback();return;}
 const L=window.L,el=document.getElementById('venue-leaflet');if(!el)return;
 const map=L.map(el,{scrollWheelZoom:false,zoomControl:true});
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
 const bounds=[];
 located.forEach(v=>{
  const icon=L.divIcon({className:'',html:markerHTML(v),iconSize:v.id==='garraway'?[38,38]:[28,28],iconAnchor:v.id==='garraway'?[19,34]:[14,25],popupAnchor:[0,-25]});
  const m=L.marker([v.geo.lat,v.geo.lng],{icon,title:v.name}).addTo(map);
  m.bindPopup(`<div class="venue-map-popup"><strong>${v.name}</strong><small>${v.area||'福岡'} / ${v.eventCount||0}掲載枠</small><button type="button" data-map-venue="${v.id}">この会場の予定</button><a href="${gm(v)}" target="_blank" rel="noopener noreferrer">Googleマップ ↗</a></div>`);
  bounds.push([v.geo.lat,v.geo.lng]);
 });
 if(bounds.length)map.fitBounds(bounds,{padding:[34,34],maxZoom:15});else map.setView([33.5904,130.4017],13);
 map.on('popupopen',()=>{document.querySelectorAll('[data-map-venue]').forEach(b=>{if(!b.dataset.mapBound){b.dataset.mapBound='1';b.addEventListener('click',()=>goVenue(b.dataset.mapVenue));}});});
 setTimeout(()=>map.invalidateSize(),120);
}

document.addEventListener('click',e=>{const b=e.target.closest('[data-map-venue]');if(b)goVenue(b.dataset.mapVenue);});

function loadLeaflet(){
 if(window.L){init();return;}
 const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIINfQ3ynzJO2TZHP2WGQfSxZqjMZb0d2mM=';css.crossOrigin='';document.head.appendChild(css);
 const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';s.crossOrigin='';s.onload=init;s.onerror=fallback;document.head.appendChild(s);
 setTimeout(()=>{if(!window.L)fallback();},5000);
}
loadLeaflet();
})();