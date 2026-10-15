import {createSalesChart} from './sales-chart.js?v=2';
// Analytics and recognition views. Database permissions are enforced by Supabase RPCs.
export async function showAnalytics(host,{call,token,cash,make}){
 host.replaceChildren(make('h2','Sales Analytics'));
 const controls=make('div',undefined,'gw-mdt-actions'),range=document.createElement('select'),status=make('p','Loading sales trends…');
 for(const [label,days] of [['Last 7 Days',7],['Last 30 Days',30],['Last 90 Days',90],['Last 365 Days',365]])range.add(new Option(label,String(days)));
 controls.append(range);host.append(controls,status);
 const chart=make('div');host.append(chart);
 const load=async()=>{
  try{
   status.textContent='Loading sales trends…';
   const end=new Date(),start=new Date(end.getTime()-Number(range.value)*86400000);
   const rows=await call('gw_mdt_sales_trends',{p_token:token(),p_from:start.toISOString(),p_to:end.toISOString()});
   chart.replaceChildren();
   const total=rows.reduce((sum,r)=>sum+Number(r.sales||0),0),orders=rows.reduce((sum,r)=>sum+Number(r.orders||0),0);
   const summary=make('div',undefined,'gw-mdt-stats');
   for(const [label,value] of [['Total Revenue',cash(total)],['Orders',String(orders)],['Average Order',cash(orders?total/orders:0)]]){const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',value));summary.append(card);}
   chart.append(summary);
   const byDay=new Map(rows.map(r=>[r.day.slice(0,10),{sales:Number(r.sales||0),orders:Number(r.orders||0)}]));
   const points=[];const first=Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate());
   const last=Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate());
   for(let timestamp=first;timestamp<=last;timestamp+=86400000){const day=new Date(timestamp).toISOString().slice(0,10);points.push({day,...(byDay.get(day)||{sales:0,orders:0})});}
   chart.append(make('h3','Daily Sales Trend'),createSalesChart(points,{cash,height:210}));
   const list=make('div',undefined,'gw-mdt-roster');for(const row of [...rows].reverse().slice(0,15)){const item=make('div',undefined,'gw-mdt-employee');item.append(make('strong',row.day),make('span',cash(row.sales)+' · '+row.orders+' orders'));list.append(item);}chart.append(list);
   status.textContent=rows.length+' days with recorded sales';
  }catch(err){status.textContent='Analytics unavailable: '+err.message;}
 };
 range.onchange=load;await load();
}

export async function showRecognition(host,employee,{call,token,canFeature,make}){
 host.replaceChildren(make('p','Loading recognition…'));
 try{
  const rows=await call('gw_mdt_recognition_list',{p_token:token(),p_employee:employee?.id||null});
  host.replaceChildren();
  if(employee&&canFeature('recognition_manage')){
   const form=make('form',undefined,'gw-mdt-form'),award=document.createElement('input'),note=document.createElement('textarea'),submit=make('button','Give Recognition','primary');
   award.placeholder='Award title (e.g. Employee of the Month)';award.required=true;award.minLength=3;award.maxLength=100;
   note.placeholder='Reason for recognition';note.required=true;note.minLength=3;note.maxLength=1500;
   form.append(award,note,submit);host.append(form);
   form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{await call('gw_mdt_recognition_add',{p_token:token(),p_employee:employee.id,p_award:award.value,p_note:note.value});await showRecognition(host,employee,{call,token,canFeature,make});}catch(err){const p=make('p',err.message);form.append(p);}finally{submit.disabled=false;}};
  }
  const list=make('div',undefined,'gw-mdt-roster');
  for(const row of rows){const item=make('div',undefined,'gw-mdt-employee'),info=make('div');info.append(make('strong',row.award+' · '+row.employee_name),make('p',row.note+' · Awarded by '+row.awarded_by+' · '+new Date(row.created_at).toLocaleString()));item.append(info);list.append(item);}
  if(!rows.length)list.append(make('p','No recognition awards recorded.'));
  host.append(list);
 }catch(err){host.replaceChildren(make('p','Recognition unavailable: '+err.message));}
}

export async function showActivitySearch(host,{call,token,make}){
 host.replaceChildren(make('h2','Management Activity History'));
 const controls=make('div',undefined,'gw-mdt-actions'),search=document.createElement('input'),from=document.createElement('input'),to=document.createElement('input'),button=make('button','Search','primary'),status=make('p','');
 search.type='search';search.placeholder='Search manager or employee';from.type='date';to.type='date';const action=document.createElement('select');for(const name of ['All Actions','Employee created','Employee updated','Permission changed','Time adjustment'])action.add(new Option(name,name==='All Actions'?'':name));controls.append(action);
 controls.append(search,from,to,button);host.append(controls,status);
 const list=make('div',undefined,'gw-mdt-roster');host.append(list);
 const load=async()=>{status.textContent='Loading activity…';try{
  const rows=await call('gw_mdt_activity_search',{p_token:token(),p_search:search.value,p_from:from.value?new Date(from.value+'T00:00:00').toISOString():null,p_to:to.value?new Date(new Date(to.value+'T00:00:00').getTime()+86400000).toISOString():null});
  list.replaceChildren();const filtered=rows.filter(r=>!action.value||r.action===action.value);for(const r of filtered){const row=make('div',undefined,'gw-mdt-employee'),info=make('div');info.append(make('strong',r.action+' · '+r.subject),make('p',(r.details||'')+' · '+r.actor+' · '+new Date(r.created_at).toLocaleString()));row.append(info);list.append(row);}if(!filtered.length)list.append(make('p','No matching activity.'));status.textContent=filtered.length+' activity records';
 }catch(err){status.textContent='Activity unavailable: '+err.message;}};
 button.onclick=load;action.onchange=load;search.onkeydown=e=>{if(e.key==='Enter')load();};await load();
}
