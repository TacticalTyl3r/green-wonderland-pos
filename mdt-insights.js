import {createSalesChart} from './sales-chart.js?v=2';
// Analytics and recognition views. Database permissions are enforced by Supabase RPCs.
export async function showAnalytics(host,{call,token,cash,make}){
 host.replaceChildren(make('h2','Sales Analytics'));
 const controls=make('div',undefined,'gw-mdt-actions'),range=document.createElement('select'),status=make('p','Loading sales analytics…');
 for(const [label,days] of [['Last 7 Days',7],['Last 30 Days',30],['Last 90 Days',90],['Last 365 Days',365]])range.add(new Option(label,String(days)));
 controls.append(range);host.append(controls,status);
 const chart=make('div');host.append(chart);
 const metric=(parent,label,value)=>{const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',value));parent.append(card);};
 const section=(title,columns,rows,empty)=>{
  chart.append(make('h3',title));
  const list=make('div',undefined,'gw-mdt-roster');
  for(const record of rows){
   const item=make('div',undefined,'gw-mdt-employee');
   item.append(make('strong',columns[0](record)),make('span',columns[1](record)));list.append(item);
  }
  if(!rows.length)list.append(make('p',empty));
  chart.append(list);
 };
 const load=async()=>{
  const days=Number(range.value),end=new Date(),start=new Date(end.getTime()-days*86400000);
  status.textContent='Loading sales analytics…';chart.replaceChildren();
  try{
   const report=await call('gw_mdt_analytics_report',{p_token:token(),p_from:start.toISOString(),p_to:end.toISOString()});
   if(!report||typeof report!=='object'||Array.isArray(report))throw Error('Report returned no data.');
   const summary=report.summary||{},gross=Number(summary.gross||0),refunded=Number(summary.refunds||0),orders=Number(summary.orders||0);
   const cards=make('div',undefined,'gw-mdt-stats');
   for(const [label,value] of [
    ['Gross Sales',cash(gross)],['Refunds & Voids',cash(refunded)],
    ['Net Sales',cash(gross-refunded)],['Orders',String(orders)],
    ['Average Order',cash(orders?gross/orders:0)],['Adjustments',String(summary.adjustments||0)]
   ])metric(cards,label,value);
   chart.append(cards);
   chart.append(make('p','Net sales = sales made during the selected period minus refunds/voids processed during that period. These can relate to older purchases.'));
   const daily=Array.isArray(report.daily)?report.daily:[],monthly=Array.isArray(report.monthly)?report.monthly:[];
   const byDay=new Map(daily.map(r=>[String(r.day).slice(0,10),r]));
   const points=[];
   let cursor=Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate());
   const last=Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate());
   for(;cursor<=last;cursor+=86400000){
    const day=new Date(cursor).toISOString().slice(0,10),row=byDay.get(day)||{};
    points.push({day,sales:Number(row.gross||0),orders:Number(row.orders||0)});
   }
   chart.append(make('h3','Daily Gross Sales'),createSalesChart(points,{cash,height:210}));
   section('Monthly Sales Comparison',[
    r=>r.month,
    r=>'Gross '+cash(r.gross)+' · Refunds '+cash(r.refunded)+' · Net '+cash(r.net)+' · '+r.orders+' orders'
   ],monthly,'No sales or refunds recorded in this period.');
   section('Top-Selling Products (by Units)',[
    r=>r.product_name,
    r=>r.units+' units · '+cash(r.gross_line_revenue)+' before discounts'
   ],Array.isArray(report.products)?report.products.slice(0,20):[],'No itemized product records in this period.');
   section('Sales by Category',[
    r=>r.category,
    r=>r.units+' units · '+cash(r.gross_line_revenue)+' before discounts'
   ],Array.isArray(report.categories)?report.categories:[],'No itemized category records in this period.');
   section('Employee Sales Performance',[
    r=>r.employee_name,
    r=>cash(r.revenue)+' gross · '+r.orders+' orders · '+cash(r.average_order)+' avg.'
   ],Array.isArray(report.employees)?report.employees:[],'No employee sales in this period.');
   chart.append(make('p',String(report.itemized_sales||0)+' of '+orders+' sales have stored itemized receipts; product and category breakdowns exclude sales without them.'));
   const discountButton=make('button','Show Recorded Discounts','outline'),discountHost=make('div');
   chart.append(discountButton,discountHost);
   discountButton.onclick=async()=>{
    discountButton.disabled=true;discountHost.replaceChildren(make('p','Reading stored receipt totals…'));
    try{
     const sales=await call('gw_mdt_sales_history',{p_token:token(),p_from:start.toISOString(),p_to:end.toISOString(),p_employee:null});
     const detailed=await call('gw_pos_search_sales',{p_token:token(),p_query:''}).catch(()=>[]);
     const ids=(Array.isArray(detailed)&&detailed.length?detailed:sales||[]).filter(x=>{
      const date=Date.parse(x.created_at||'');return Number.isFinite(date)&&date>=start.getTime()&&date<=end.getTime();
     }).map(x=>x.sale_id||x.id).filter(Boolean).slice(0,100);
     const totals={manual_discount:0,offer_discount:0,reward_discount:0};let found=0;
     for(let i=0;i<ids.length;i+=8){
      const results=await Promise.all(ids.slice(i,i+8).map(async id=>{
       try{return await call('gw_pos_get_receipt_financials',{p_token:token(),p_sale:String(id)});}catch(e){return null;}
      }));
      for(const row of results){if(!row)continue;const data=Array.isArray(row)?row[0]:row;if(!data)continue;found++;for(const k of Object.keys(totals))totals[k]+=Number(data[k]||0);}
     }
     discountHost.replaceChildren();const stats=make('div',undefined,'gw-mdt-stats');
     for(const [name,value] of [['Saved Receipt Discounts',Object.values(totals).reduce((a,b)=>a+b,0)],['Manual',totals.manual_discount],['Specials & Bundles',totals.offer_discount],['Loyalty Rewards',totals.reward_discount]])metric(stats,name,cash(value));
     discountHost.append(stats,make('p','Sample: '+found+' of '+ids.length+' recent matched receipts, maximum 100. Not an all-sales discount total.'));
    }catch(e){discountHost.replaceChildren(make('p','Discount report unavailable: '+e.message));}
    finally{discountButton.disabled=false;}
   };
   status.textContent='Report ready · '+days+'-day period · All recorded transactions in range';
  }catch(err){status.textContent='Analytics report requires the new Supabase migration: '+err.message;}
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
 host.replaceChildren();
 const root=make('section',undefined,'gw-audit');
 const head=make('div',undefined,'gw-audit-head');
 const intro=make('div');intro.append(make('small','ADMINISTRATION · ACTIVITY RECORDS'),make('h2','Full Audit Log'),make('p','See who performed each action, who or what was affected, and when it happened.'));
 head.append(intro);root.append(head);
 const controls=make('div',undefined,'gw-audit-controls');
 const search=document.createElement('input');search.type='search';search.placeholder='Search employee, manager, or details…';search.setAttribute('aria-label','Search audit history');
 const from=document.createElement('input'),to=document.createElement('input');from.type='date';to.type='date';from.title='From date';to.title='Through date';
 const action=document.createElement('select');action.setAttribute('aria-label','Filter by action');
 const types=[['','All actions'],['Employee created','Employee created'],['Employee updated','Employee updated'],['Permission changed','Permission changed'],['Time adjustment','Time adjustment'],['Sale refunded','Sale refunded'],['Sale voided','Sale voided'],['Loyalty points adjusted','Loyalty points adjusted'],['Loyalty reward redeemed','Loyalty reward redeemed'],['Employee promoted','Employee promoted'],['Employee separated','Employee separated'],['Employee rehired','Employee rehired']];
 types.forEach(([value,label])=>action.add(new Option(label,value)));
 const button=make('button','Search Audit Log','primary');
 const exportButton=make('button','Export CSV','outline');exportButton.disabled=true;
 controls.append(search,action,from,to,button,exportButton);root.append(controls);
 const status=make('p','Loading activity…','gw-audit-status');root.append(status);
 const summary=make('div',undefined,'gw-audit-summary');root.append(summary);
 const list=make('div',undefined,'gw-audit-list');root.append(list);host.append(root);
 const classify=r=>{const a=String(r.action||'').toLowerCase();if(a.includes('refund')||a.includes('void'))return 'sales';if(a.includes('loyalty')||a.includes('reward'))return 'loyalty';if(a.includes('promot')||a.includes('separat')||a.includes('rehir'))return 'employee';if(a.includes('time')||a.includes('hour'))return 'time';if(a.includes('permission')||a.includes('role'))return 'permission';if(a.includes('creat')||a.includes('add'))return 'created';if(a.includes('delet')||a.includes('remov')||a.includes('terminat'))return 'removed';if(a.includes('updat')||a.includes('edit')||a.includes('chang'))return 'updated';return 'other';};
 const icon={time:'◷',permission:'◆',created:'+',removed:'−',updated:'✎',employee:'♙',sales:'};
 const render=rows=>{
  list.replaceChildren();summary.replaceChildren();
  const filtered=rows.filter(r=>!action.value||r.action===action.value);
  const stats=[['Total Actions',filtered.length,'total'],['Employee Changes',filtered.filter(r=>['created','updated','removed','employee'].includes(classify(r))).length,'employee'],['Permissions',filtered.filter(r=>classify(r)==='permission').length,'permission'],['Time Adjustments',filtered.filter(r=>classify(r)==='time').length,'time'],['Refunds / Voids',filtered.filter(r=>classify(r)==='sales').length,'sales'],['Loyalty Actions',filtered.filter(r=>classify(r)==='loyalty').length,'loyalty']];
  for(const [label,count,kind] of stats){const card=make('div',undefined,'gw-audit-stat '+kind);card.append(make('span',label),make('strong',String(count)));summary.append(card);}
  for(const r of filtered){
   const kind=classify(r),card=make('article',undefined,'gw-audit-card gw-audit-'+kind);
   const glyph=make('span',icon[kind],'gw-audit-icon');
   const body=make('div',undefined,'gw-audit-card-body');
   const title=make('div',undefined,'gw-audit-card-title');
   title.append(make('strong',r.action||'Recorded action'),make('span',kind.toUpperCase(),'gw-audit-tag'));
   const people=make('div',undefined,'gw-audit-people');
   const who=make('div',undefined,'gw-audit-person');who.append(make('small','PERFORMED BY'),make('strong',r.actor||'Unknown'));
   const affected=make('div',undefined,'gw-audit-person');affected.append(make('small','AFFECTED EMPLOYEE / RECORD'),make('strong',r.subject||'Not specified'));
   people.append(who,affected);
   const details=make('p',r.details||'No additional details were recorded for this action.','gw-audit-details');
   const footer=make('div',undefined,'gw-audit-footer');
   const date=new Date(r.created_at);footer.append(make('span',Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleString()));
   body.append(title,people,details,footer);card.append(glyph,body);list.append(card);
  }
  if(!filtered.length)list.append(make('p','No audit records match your filters.','gw-audit-empty'));
  status.textContent=filtered.length+' activity records displayed'+(rows.length>=500?' · Results may be limited to 500 records':'');
  exportButton.disabled=!filtered.length;
  exportButton.onclick=()=>{const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[['Action','Performed By','Affected Employee / Record','Details','Date'],...filtered.map(r=>[r.action,r.actor,r.subject,r.details,r.created_at])].map(row=>row.map(esc).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='green-wonderland-full-audit-log.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
 };
 let records=[];
 const load=async()=>{status.textContent='Loading activity…';exportButton.disabled=true;try{records=await call('gw_mdt_activity_search',{p_token:token(),p_search:search.value,p_from:from.value?new Date(from.value+'T00:00:00').toISOString():null,p_to:to.value?new Date(new Date(to.value+'T00:00:00').getTime()+86400000).toISOString():null});render(records);}catch(err){status.textContent='Activity unavailable: '+err.message;}};
 button.onclick=load;action.onchange=()=>render(records);search.onkeydown=e=>{if(e.key==='Enter')load();};await load();
}
,loyalty:'★',other:'▤'};
 const render=rows=>{
  list.replaceChildren();summary.replaceChildren();
  const filtered=rows.filter(r=>!action.value||r.action===action.value);
  const stats=[['Total Actions',filtered.length,'total'],['Employee Changes',filtered.filter(r=>['created','updated','removed'].includes(classify(r))).length,'employee'],['Permissions',filtered.filter(r=>classify(r)==='permission').length,'permission'],['Time Adjustments',filtered.filter(r=>classify(r)==='time').length,'time']];
  for(const [label,count,kind] of stats){const card=make('div',undefined,'gw-audit-stat '+kind);card.append(make('span',label),make('strong',String(count)));summary.append(card);}
  for(const r of filtered){
   const kind=classify(r),card=make('article',undefined,'gw-audit-card gw-audit-'+kind);
   const glyph=make('span',icon[kind],'gw-audit-icon');
   const body=make('div',undefined,'gw-audit-card-body');
   const title=make('div',undefined,'gw-audit-card-title');
   title.append(make('strong',r.action||'Recorded action'),make('span',kind.toUpperCase(),'gw-audit-tag'));
   const people=make('div',undefined,'gw-audit-people');
   const who=make('div',undefined,'gw-audit-person');who.append(make('small','PERFORMED BY'),make('strong',r.actor||'Unknown'));
   const affected=make('div',undefined,'gw-audit-person');affected.append(make('small','AFFECTED EMPLOYEE / RECORD'),make('strong',r.subject||'Not specified'));
   people.append(who,affected);
   const details=make('p',r.details||'No additional details were recorded for this action.','gw-audit-details');
   const footer=make('div',undefined,'gw-audit-footer');
   const date=new Date(r.created_at);footer.append(make('span',Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleString()));
   body.append(title,people,details,footer);card.append(glyph,body);list.append(card);
  }
  if(!filtered.length)list.append(make('p','No audit records match your filters.','gw-audit-empty'));
  status.textContent=filtered.length+' activity records displayed'+(rows.length>=500?' · Results may be limited to 500 records':'');
  exportButton.disabled=!filtered.length;
  exportButton.onclick=()=>{const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[['Action','Performed By','Affected Employee / Record','Details','Date'],...filtered.map(r=>[r.action,r.actor,r.subject,r.details,r.created_at])].map(row=>row.map(esc).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='green-wonderland-full-audit-log.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
 };
 let records=[];
 const load=async()=>{status.textContent='Loading activity…';exportButton.disabled=true;try{records=await call('gw_mdt_activity_search',{p_token:token(),p_search:search.value,p_from:from.value?new Date(from.value+'T00:00:00').toISOString():null,p_to:to.value?new Date(new Date(to.value+'T00:00:00').getTime()+86400000).toISOString():null});render(records);}catch(err){status.textContent='Activity unavailable: '+err.message;}};
 button.onclick=load;action.onchange=()=>render(records);search.onkeydown=e=>{if(e.key==='Enter')load();};await load();
}
