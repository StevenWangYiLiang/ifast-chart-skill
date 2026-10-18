import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {axisScale} from './axis-scale.mjs';
import {prepareChart,renderChart,escapeXml} from './chart-layout.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),skill=path.dirname(here);
const fail=message=>{throw Error(message);};
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++) {
  const key=args[i];
  if(key==='--overwrite'){options.overwrite=true;continue;}
  if(!['--spec','--out','--theme','--size','--formats','--python'].includes(key)||!args[i+1])fail(`Unknown or incomplete option: ${key}`);
  options[key.slice(2)]=args[++i];
}
if(!options.spec||!options.out)fail('Usage: node render.mjs --spec input.json --out output-directory [--size medium] [--overwrite]');
const source=await fs.readFile(path.resolve(options.spec),'utf8'),input=JSON.parse(source);
const standards=JSON.parse(await fs.readFile(path.join(skill,'assets/standards.json'),'utf8'));
const themeOption=options.theme??input.theme??'ifast';
const themePath=/^[a-z0-9-]+$/.test(themeOption)?path.join(skill,'assets/themes',themeOption+'.json'):path.resolve(themeOption);
const palette=JSON.parse(await fs.readFile(themePath,'utf8'));
const theme={...palette,...standards};
if(!Array.isArray(palette.categorical)||palette.categorical.some(c=>!/^#[0-9a-f]{6}$/i.test(c)))fail('Theme needs hexadecimal categorical colors.');
const size=options.size??input.size??standards.chart.defaultSize;
const formats=(options.formats??'html,svg,xlsx').split(',');
if(formats.some(f=>!['html','svg','xlsx'].includes(f)))fail('Formats must be html, svg or xlsx.');
if(!Array.isArray(input.charts)||!input.charts.length)fail('charts must be a nonempty array.');
const usedIds=new Set(),usedSheets=new Set();
const charts=input.charts.map(raw=>{
  if(!/^[a-z0-9-]+$/.test(raw.id??'')||usedIds.has(raw.id))fail('Each chart needs a unique lowercase id.');
  usedIds.add(raw.id);
  const type={line:'line',column:'bar',stacked_column:'stack'}[raw.type];
  if(!type)fail(`Unsupported chart type: ${raw.type}`);
  if(typeof raw.title!=='string'||!raw.title.trim())fail('A chart title is required.');
  const labels=raw.x?.values;
  if(!Array.isArray(labels)||labels.length<2||labels.some(x=>typeof x!=='string'))fail('x.values must contain at least two string labels.');
  if(!['date','category'].includes(raw.x.type))fail('x.type must be date or category.');
  if(raw.x.type==='date') {
    let previous='';
    for(const d of labels){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||new Date(d).toISOString().slice(0,10)!==d||d<=previous)fail('Dates must be unique valid ISO dates in ascending order.');previous=d;}
  }
  if(!Array.isArray(raw.axes)||raw.axes.length<1||raw.axes.length>2)fail('Provide one or two explicitly defined axes.');
  if(type!=='line'&&raw.axes.length!==1)fail('Column and stacked-column charts use one comparable value axis.');
  if(!raw.source?.label||!raw.source?.as_of)fail('Provide source.label and source.as_of; use an explicit unknown marker when unavailable.');
  if(!Array.isArray(raw.series)||!raw.series.length)fail('A chart needs data series.');
  const values=raw.series.map(s=>{
    if(!s.name||!Number.isInteger(s.axis??0)||(s.axis??0)<0||(s.axis??0)>=raw.axes.length)fail('Invalid series name or axis mapping.');
    if(!Array.isArray(s.values)||s.values.length!==labels.length||s.values.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v))))fail('Series values must be finite numbers or null, aligned to x.values.');
    if(type==='stack'&&s.values.some(v=>v===null||v<0))fail('Stacked columns require nonnegative complete data; no invented missing values.');
    return s.values;
  });
  const axes=raw.series.map(s=>s.axis??0);
  if(axes.some((a,i)=>a===0&&axes.slice(0,i).includes(1)))fail('List primary-axis series before secondary-axis series to preserve native legend order.');
  const scales=raw.axes.map((_,a)=>{
    if(!axes.includes(a))fail('Every declared axis must be used.');
    if(type==='stack') {
      const totals=labels.map((_,i)=>values.reduce((n,v)=>n+v[i],0));
      if(raw.axes[0].percent_fraction&&totals.every(v=>Math.abs(v-1)<1e-8))return {min:0,max:1,step:.2,count:6};
      return axisScale(totals);
    }
    return axisScale(values.filter((_,j)=>axes[j]===a).flat());
  });
  const sheet=raw.sheet??raw.id.slice(0,31);
  if(!sheet||sheet.length>31||/[\[\]:*?/\\]/.test(sheet)||usedSheets.has(sheet))fail('Sheet names must be unique and valid Excel names, at most 31 characters.');
  usedSheets.add(sheet);
  const colors=raw.series.map((s,i)=>s.color??theme.categorical[i%theme.categorical.length]);
  if(colors.some(c=>!/^#[0-9a-f]{6}$/i.test(c)))fail('Series colors must be hexadecimal.');
  if(raw.series.length>theme.categorical.length&&raw.series.some(s=>!s.color))fail('Too many series for the palette; split charts or explicitly define distinguishable colors.');
  const unknown=raw.axes.some(a=>a.unit===null||a.unit==='');
  if(raw.axes.some(a=>a.unit!==null&&typeof a.unit!=='string'))fail('Axis units must be strings or null.');
  const c={id:raw.id,sheet,title:raw.title,type,labels,dates:raw.x.type==='date'?labels:undefined,names:raw.series.map(s=>s.name),values,axes,scales,colors,units:raw.axes.map(a=>a.unit||'未注明'),axisPercentFractions:raw.axes.map(a=>Boolean(a.percent_fraction)),source:raw.source,note:raw.note??'',warning:unknown?'注：部分序列单位未注明。':raw.warning,sourceShort:'来源：'+raw.source.label};
  return prepareChart(c,theme,size);
});
const output=path.resolve(options.out);
const names=['normalized.json','manifest.json',...(formats.includes('html')?['charts.html']:[]),...(formats.includes('xlsx')?['charts.xlsx']:[]),...(formats.includes('svg')?charts.map(c=>c.id+'.svg'):[])];
await fs.mkdir(output,{recursive:true});
if(!options.overwrite)for(const name of names){if(await fs.stat(path.join(output,name)).catch(()=>null))fail(`Output exists: ${name}. Use a new directory or authorized --overwrite.`);}
const normalized={version:1,theme,charts,formats};
await fs.writeFile(path.join(output,'normalized.json'),JSON.stringify(normalized,null,2));
if(formats.includes('xlsx')) {
  const result=spawnSync(options.python??process.env.PYTHON??'python',[path.join(here,'export_xlsx.py'),path.join(output,'normalized.json'),path.join(output,'charts.xlsx')],{stdio:'inherit',windowsHide:true});
  if(result.status!==0)fail('XLSX export failed. Confirm Python and requirements.txt dependencies.');
}
if(formats.includes('svg'))for(const c of charts)await fs.writeFile(path.join(output,c.id+'.svg'),renderChart(c,theme,size));
if(formats.includes('html')) {
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>图表总览</title><style>body{background:${theme.colors.background};color:${theme.colors.text};font:9pt '${theme.typography.cjk}',sans-serif;margin:0}main{max-width:1100px;margin:24px auto;padding:0 16px}section{background:white;margin:20px 0;padding:16px}.frame{overflow:auto}svg{display:block;margin:auto;max-width:none}h1{font-size:12pt}p{line-height:1.8}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{padding:6px;text-align:right;border-bottom:1px solid ${theme.colors.grid}}td:first-child,th:first-child{text-align:left}th{background:${theme.colors.primary};color:white}summary{cursor:pointer}@media print{section{break-inside:avoid}details{display:none}}</style><main><h1>图表总览</h1>${charts.map(c=>`<section><div class="frame">${renderChart(c,theme,size)}</div><p>来源：${escapeXml(c.source.label)}；截止时点：${escapeXml(c.source.as_of)}。${escapeXml(c.note)}</p><details><summary>查看绘图数据</summary><table><tr><th>日期 / 类别</th>${c.names.map(n=>`<th>${escapeXml(n)}</th>`).join('')}</tr>${c.labels.map((x,i)=>`<tr><td>${escapeXml(x)}</td>${c.values.map(v=>`<td>${v[i]===null?'缺失':v[i]}</td>`).join('')}</tr>`).join('')}</table></details></section>`).join('')}<p>HTML/SVG 为快照；Excel 修改绘图数据后更新曲线。数据量级变化后需重新计算步长。字体未嵌入。</p></main></html>`;
  await fs.writeFile(path.join(output,'charts.html'),html);
}
const artifacts={};
for(const name of names.filter(n=>n!=='manifest.json'))artifacts[name]=createHash('sha256').update(await fs.readFile(path.join(output,name))).digest('hex');
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({version:1,inputSha256:createHash('sha256').update(source).digest('hex'),artifacts,verification:{structural:'run verify.py',font:'not yet verified',nativeApplication:'not yet verified'}},null,2));
console.log(`Created ${charts.length} chart(s): ${formats.join(', ')}. Font and native application rendering require separate checks.`);
