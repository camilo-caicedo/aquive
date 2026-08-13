const fs=require('fs'),path=require('path');
const d=require('./dane.json');
const LOW=new Set(['DE','DEL','Y','E']);
const ART=new Set(['LA','LAS','LOS','EL']);
const tc=s=>s.split(/(\s+|-)/).map((w,i,a)=>{
  if(/^(\s+|-)$/.test(w))return w;
  const prev=a.slice(0,i).filter(x=>!/^(\s+|-)$/.test(x)).pop();
  const first=prev===undefined;
  const cap=w.charAt(0)+w.slice(1).toLowerCase();
  if(first)return cap;
  if(LOW.has(w))return w.toLowerCase();
  if(ART.has(w)&&(prev==='DE'||prev==='DEL'))return w.toLowerCase();
  return cap;
}).join('');
const DEPT={'BOGOTÁ, D.C.':'Bogotá D.C.','ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA':'Archipiélago de San Andrés, Providencia y Santa Catalina','LA GUAJIRA':'La Guajira','NORTE DE SANTANDER':'Norte de Santander','VALLE DEL CAUCA':'Valle del Cauca'};
const MUN={'BOGOTÁ, D.C.':'Bogotá D.C.'};
const q=s=>"'"+s.replace(/'/g,"''")+"'";
const rows=d.map(x=>({c:x.cod_mpio.padStart(5,'0'),n:MUN[x.nom_mpio]||tc(x.nom_mpio),p:DEPT[x.dpto]||tc(x.dpto)}))
  .sort((a,b)=>a.c<b.c?-1:a.c>b.c?1:0);
const out='-- Municipios de Colombia (código DANE oficial). Generado desde datos.gov.co, dataset gdxc-w37w (DANE, Divipola: municipios, áreas no municipalizadas e isla).\n'
+'insert into public.municipios (codigo_dane, nombre, departamento) values\n'
+rows.map(r=>`  (${q(r.c)},${q(r.n)},${q(r.p)})`).join(',\n')
+'\non conflict (codigo_dane) do update set\n  nombre = excluded.nombre,\n  departamento = excluded.departamento;\n';
const dest='C:/Users/camil/Documents/GitHub/aquive/supabase/seed-municipios.sql';
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,out,'utf8');
console.log('rows',rows.length,'depts',new Set(rows.map(r=>r.p)).size);
console.log(rows.slice(0,3).map(r=>r.n+' / '+r.p).join(' | '));
