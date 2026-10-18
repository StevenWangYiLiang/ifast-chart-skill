// Shared physical sizing, units, date ticks and SVG layout for all chart outputs.
export const escapeXml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const textWidth=s=>[...String(s)].reduce((n,c)=>n+(/[\u0000-\u007f]/.test(c)?6.1:12),0);
export function chartSize(theme,size=theme.chart.defaultSize) {
  const cm=theme.chart.sizesCm[size];
  if(!cm)throw Error(`Unknown chart size: ${size}`);
  return {...cm,widthPx:cm.width*96/2.54,heightPx:cm.height*96/2.54,widthPt:cm.width*72/2.54,heightPt:cm.height*72/2.54,name:size};
}
export function axisDisplay(scale,unit,theme,percentFraction=false) {
  const max=Math.max(Math.abs(scale.min),Math.abs(scale.max));
  let selected={label:'',factor:1};
  if(max>theme.chart.largeNumberThreshold) {
    for(const candidate of theme.chart.preferredDisplayUnits)if(max>=candidate.factor)selected=candidate;
  }
  const multiplier=percentFraction?100:1,step=scale.step*multiplier/selected.factor;
  let decimals=0;
  while(decimals<6&&Math.abs(Number(step.toFixed(decimals))-step)>1e-8)decimals++;
  return {factor:selected.factor,multiplier,unit:selected.label+unit,decimals,numberFormat:'0'+(decimals?'.'+'0'.repeat(decimals):'')+(percentFraction?'%':''),percentFraction};
}
export function prepareChart(c,theme,sizeName) {
  c.size=chartSize(theme,sizeName);
  c.axisDisplays=c.scales.map((scale,a)=>axisDisplay(scale,c.units[a],theme,c.axisPercentFractions?.[a]??c.percentFraction??false));
  if(c.dates) {
    const first=new Date(c.dates[0]+'T00:00:00Z'),last=new Date(c.dates.at(-1)+'T00:00:00Z');
    c.dateDomain={min:Date.UTC(first.getUTCFullYear(),0,1),max:last.getTime()};
    c.yearTicks=[];
    for(let year=first.getUTCFullYear();year<=last.getUTCFullYear();year++)c.yearTicks.push({value:Date.UTC(year,0,1),label:String(year)});
  }
  return c;
}
export function renderChart(c,theme,sizeName) {
  prepareChart(c,theme,sizeName);
  const {widthPx:W,heightPx:H}=c.size;
  const names=c.legendNames??c.names,colors=c.colors??theme.categorical;
  const rows=[[]];let used=0;
  names.forEach((name,j)=>{const w=textWidth(name)+35;if(used+w>W-24&&rows.at(-1).length){rows.push([]);used=0;}rows.at(-1).push({name,j,width:w});used+=w;});
  const notes=c.warning?2:1,footer=notes*15+4;
  const legendHeight=rows.length*18;
  const B=H-footer-legendHeight-32,T=59,L=48,R=W-(c.scales.length===2?45:15);
  if(B-T<55)throw Error('Chart height is insufficient for fixed font sizes.');
  const sy=(v,a=0)=>B-(v-c.scales[a].min)/(c.scales[a].max-c.scales[a].min)*(B-T);
  const x=i=>c.dates?L+(R-L)*(Date.parse(c.dates[i]+'T00:00:00Z')-c.dateDomain.min)/(c.dateDomain.max-c.dateDomain.min):L+(R-L)*(i+.5)/c.labels.length;
  const s=[`<svg xmlns="http://www.w3.org/2000/svg" width="${c.size.width}cm" height="${c.size.height}cm" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(c.title)}">`,
    `<style>text{font:12px '${theme.typography.cjk}',sans-serif;fill:${theme.colors.text}}.muted{fill:${theme.colors.mutedText}}.point{opacity:0}.point:hover{opacity:1}</style>`,
    `<rect width="${W}" height="${H}" fill="white"/><text x="${W/2}" y="24" text-anchor="middle" style="font-size:16px;font-weight:700">${escapeXml(c.title)}</text>`];
  c.scales.forEach((scale,a)=>{
    const display=c.axisDisplays[a];
    s.push(`<text data-axis-unit="${a}" x="${a===0?L:R}" y="46" text-anchor="${a===0?'start':'end'}" class="muted">${escapeXml(display.unit)}</text>`);
    for(let k=0;k<=Math.round((scale.max-scale.min)/scale.step);k++) {
      const v=scale.min+k*scale.step,py=sy(v,a);
      const label=(v*display.multiplier/display.factor).toFixed(display.decimals)+(display.percentFraction?'%':'');
      if(a===0)s.push(`<line x1="${L}" y1="${py}" x2="${R}" y2="${py}" stroke="${v===0?theme.colors.benchmark:theme.colors.grid}" stroke-width="${v===0?1:.7}"/>`);
      s.push(`<text data-y-axis="${a}" x="${a===0?L-8:R+8}" y="${py+4}" text-anchor="${a===0?'end':'start'}" class="muted">${label}</text>`);
    }
  });
  if(c.dates) {
    c.yearTicks.forEach((tick,i)=>{
      const tx=L+(R-L)*(tick.value-c.dateDomain.min)/(c.dateDomain.max-c.dateDomain.min);
      s.push(`<line data-year="${tick.label}" data-date="${tick.label}-01-01" x1="${tx}" y1="${B}" x2="${tx}" y2="${B+5}" stroke="${theme.colors.mutedText}" stroke-width=".8"/>`);
      s.push(`<text x="${tx}" y="${B+20}" text-anchor="middle" class="muted">${W>400?tick.label:tick.label.slice(2)}</text>`);
    });
  } else c.labels.forEach((label,i)=>s.push(`<text x="${x(i)}" y="${B+20}" text-anchor="middle" class="muted">${escapeXml(label)}</text>`));
  if(c.type==='line') {
    c.values.forEach((values,j)=>{
      let points=[];const a=c.axes[j];
      const flush=()=>{if(points.length)s.push(`<polyline points="${points.join(' ')}" fill="none" stroke="${colors[j]}" stroke-width="1.8" stroke-linejoin="round"/>`);points=[];};
      values.forEach((v,i)=>{if(v===null){flush();return;}points.push(`${x(i)},${sy(v,a)}`);});flush();
      values.forEach((v,i)=>{if(v!==null)s.push(`<circle class="point" cx="${x(i)}" cy="${sy(v,a)}" r="4" fill="${colors[j]}"><title>${escapeXml(c.names[j])} · ${c.labels[i]}：${v}</title></circle>`);});
    });
  } else if(c.type==='bar') {
    const bw=Math.min(25,(R-L)/c.labels.length/3);
    c.values.forEach((vs,j)=>vs.forEach((v,i)=>{const top=sy(v),zero=sy(0),left=x(i)+(j-(c.values.length-1)/2)*bw-bw/2;
      s.push(`<rect x="${left}" y="${Math.min(top,zero)}" width="${bw-2}" height="${Math.abs(top-zero)}" fill="${colors[j]}"><title>${escapeXml(c.names[j])}：${v}</title></rect>`);
    }));
  } else {
    const bw=Math.min(56,(R-L)/c.labels.length*.52);
    c.labels.forEach((_,i)=>{let base=0;c.values.forEach((vs,j)=>{const v=vs[i],top=sy(base+v),height=sy(base)-top;
      const display=c.axisDisplays[0],label=display.percentFraction?`${Math.round(v*100)}%`:(v/display.factor).toFixed(display.decimals);
      s.push(`<rect x="${x(i)-bw/2}" y="${top}" width="${bw}" height="${height}" fill="${colors[j]}"/><text x="${x(i)}" y="${top+height/2+4}" text-anchor="middle" style="fill:${j===1?theme.colors.text:'#FFFFFF'}">${label}</text>`);base+=v;});});
  }
  rows.forEach((row,i)=>{let left=(W-row.reduce((n,a)=>n+a.width,0))/2;const py=B+38+i*18;
    row.forEach(({name,j,width})=>{s.push(c.type==='line'?`<line x1="${left}" y1="${py}" x2="${left+19}" y2="${py}" stroke="${colors[j]}" stroke-width="1.8"/>`:`<rect x="${left}" y="${py-4}" width="13" height="9" fill="${colors[j]}"/>`);
      s.push(`<text x="${left+24}" y="${py+4}">${escapeXml(name)}</text>`);left+=width;});});
  s.push(`<text x="12" y="${H-footer+12}" class="muted">${escapeXml(c.sourceShort??'来源：模拟数据，仅用于格式测试。')}</text>`);
  if(c.warning)s.push(`<text x="12" y="${H-4}" class="muted">${escapeXml(c.warning)}</text>`);
  return s.join('\n')+'</svg>';
}
