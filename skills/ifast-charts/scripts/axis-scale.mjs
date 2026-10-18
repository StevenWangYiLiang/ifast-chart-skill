// Include zero and choose readable steps with four to seven labels.
export function axisScale(values) {
  const finite=values.filter(Number.isFinite);
  if(!finite.length)throw new Error('Cannot scale an empty numeric series.');
  const lo=Math.min(0,...finite), hi=Math.max(0,...finite);
  if(lo===0&&hi===0)return {min:0,max:1,step:.2,count:6};
  const span=hi-lo||1;
  const power=10**Math.floor(Math.log10(span/5));
  const candidates=[];
  for(let e=-1;e<=2;e++)for(const n of [1,2,2.5,5]) {
    const step=n*power*10**e;
    const min=lo===0?0:Math.floor((lo-span*.025)/step)*step;
    const max=hi===0?0:Math.ceil((hi+span*.025)/step)*step;
    const count=Math.round((max-min)/step)+1;
    if(count>=4&&count<=7)candidates.push({min,max,step,count,score:Math.abs(count-6)+(max-min-span)/span*.4});
  }
  if(!candidates.length)throw new Error('No readable axis scale found.');
  candidates.sort((a,b)=>a.score-b.score);
  const {min,max,step,count}=candidates[0];
  return {min,max,step,count};
}
