export async function showEnhancedActivitySearch(host,{call,token,make}){
 host.replaceChildren();
 const root=make('section',undefined,'gw-audit');
 const head=make('div',undefined,'gw-audit-head');
 const intro=make('div');intro.append(make('small','ADMINISTRATION · ACTIVITY RECORDS'),make('h2','Full Audit Log'),make('p','See who performed each action, who or what was affected, and when it happened.'));
 head.append(intro);root.append(head);
 const controls=make('div',undefined,'gw-audit-controls');
 const search=document.createElement('input');search.type='search';search.placeholder='Search employee, manager, or details…';search.setAttribute('aria-label','Search audit history');
 const from=document.createElement('input'),to=document.createElement('input');from.type='date';to.type='date';from.title='From date';to.title='Through date';
 const action=document.createElement('select');action.setAttribute('aria-label','Filter by action');
 const types=[['','All actions'],['Employee created','Employee created'],['Employee updated','Employee updated'],['Permission changed','Permission changed'],['Time adjustment','Time adjustment'],['Sale refunded','Sale refunded'],['Sale voided','Sale voided'],['Loyalty points adjusted','Loyalty points adjusted'],['Loyalty reward redeemed','Loyalty reward redeemed'],['Employee promoted','Employee promoted'],['Employee separated','Employee separated'],['Employee rehired','Employee rehired'],['Employee role changed','Employee role changed']];
 types.forEach(([value,label])=>action.add(new Option(label,value)));
 const button=make('button','Search Audit Log','primary');
 const exportButton=make('button','Export CSV','outline');exportButton.disabled=true;
 controls.append(search,action,from,to,button,exportButton);root.append(controls);
 const status=make('p','Loading activity…','gw-audit-status');root.append(status);
 const summary=make('div',undefined,'gw-audit-summary');root.append(summary);
 const list=make('div',undefined,'gw-audit-list');root.append(list);host.append(root);
 const classify=r=>{const a=String(r.action||'').toLowerCase();if(a.includes('refund')||a.includes('void'))return 'sales';if(a.includes('loyalty')||a.includes('reward'))return 'loyalty';if(a.includes('promot')||a.includes('separat')||a.includes('rehir'))return 'employee';if(a.includes('time')||a.includes('hour'))return 'time';if(a.includes('permission')||a.includes('role'))return 'permission';if(a.includes('creat')||a.includes('add'))return 'created';if(a.includes('delet')||a.includes('remov')||a.includes('terminat'))return 'removed';if(a.includes('updat')||a.includes('edit')||a.includes('chang'))return 'updated';return 'other';};
 const icon={time:'◷',permission:'◆',created:'+',removed:'−',updated:'✎',employee:'♙',sales:'$',loyalty:'★',other:'▤'};
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
