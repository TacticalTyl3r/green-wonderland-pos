// Shared accessible sales chart: visible dates, keyboard/touch support, and hover details.
export function createSalesChart(points,{cash,height=190}){
 const root=document.createElement('section');root.className='gw-sales-chart';root.style.cssText='width:100%;min-width:0;margin:12px 0 18px';
 const detail=document.createElement('div');detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');
 detail.style.cssText='min-height:26px;font-size:14px;font-weight:600;margin:0 0 8px';
 detail.textContent='Move your mouse over a bar, tap it, or use Tab to inspect a day.';
 const graph=document.createElement('div');graph.style.cssText='display:flex;align-items:stretch;gap:3px;height:'+height+'px;border-bottom:1px solid #777;padding:0 3px;overflow:visible';
 const max=Math.max(1,...points.map(p=>Number(p.sales||0)));
 const formatDate=day=>{const [y,m,d]=day.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});};
 const show=(point,bar)=>{detail.textContent=formatDate(point.day)+' · '+cash(point.sales)+' · '+(point.orders||0)+' orders';for(const child of graph.children)child.style.outline='none';bar.style.outline='2px solid #d9f6e5';};
 points.forEach(point=>{
  const column=document.createElement('div');column.style.cssText='flex:1;min-width:0;display:flex;align-items:flex-end;position:relative';
  const bar=document.createElement('button');bar.type='button';
  const amount=Number(point.sales||0),pct=amount>0?Math.max(5,Math.round(amount/max*100)):2;
  bar.style.cssText='display:block;width:100%;height:'+pct+'%;min-height:3px;padding:0;margin:0;border:0;border-radius:3px 3px 0 0;background:#78b993;cursor:pointer;box-shadow:none;transition:background .12s';
  bar.setAttribute('aria-label',formatDate(point.day)+': '+cash(amount)+', '+(point.orders||0)+' orders');
  bar.title=formatDate(point.day)+' — '+cash(amount)+' — '+(point.orders||0)+' orders';
  bar.addEventListener('pointerenter',()=>show(point,bar));
  bar.addEventListener('focus',()=>show(point,bar));
  bar.addEventListener('click',()=>show(point,bar));
  column.append(bar);graph.append(column);
 });
 const axis=document.createElement('div');axis.style.cssText='display:flex;justify-content:space-between;gap:6px;font-size:12px;color:#bfc7c3;margin-top:8px;white-space:nowrap';
 const count=points.length;
 if(count){const ticks=Math.min(count,6);const used=new Set();for(let i=0;i<ticks;i++){const index=ticks===1?0:Math.round(i*(count-1)/(ticks-1));if(used.has(index))continue;used.add(index);const label=document.createElement('span');label.textContent=formatDate(points[index].day);axis.append(label);}}
 root.append(detail,graph,axis);
 return root;
}
