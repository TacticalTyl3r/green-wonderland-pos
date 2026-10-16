// Green Wonderland business operations screens. All reads/writes use permission-checked RPCs.
export async function renderBusinessPage(page,{host,call,token,canFeature,cash,make}){
 host.replaceChildren();
 const heading=make('h2',({history:'Sales History',announcements:'Employee Announcements',leaderboard:'Employee Leaderboards',notes:'Employee Notes',reports:'Financial Reports'})[page]||page);
 host.append(heading);
 const status=make('p','Loading…');host.append(status);
 const rpc=(name,args={})=>call(name,{p_token:token(),...args});
 const box=()=>{const div=make('div',undefined,'gw-mdt-roster');host.append(div);return div;};
 const line=(parent,title,description)=>{const row=make('div',undefined,'gw-mdt-employee'),info=make('div');info.append(make('strong',title),make('p',description));row.append(info);parent.append(row);return row;};
 const dateText=d=>new Date(d).toLocaleString();
 const exportCsv=(filename,headers,rows)=>{const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
 try{
  if(page==='history'){
   const filter=make('div',undefined,'gw-mdt-actions'),from=document.createElement('input'),to=document.createElement('input'),search=document.createElement('input');
   from.type='date';to.type='date';search.type='search';search.placeholder='Search employee, amount, fulfillment, date or sale ID';
   filter.append(from,to,search);host.insertBefore(filter,status);
   const list=box(),download=make('button','Export Filtered CSV','outline');filter.append(download);
   const reload=async()=>{status.textContent='Loading sales…';try{
    const rows=await rpc('gw_mdt_sales_history',{p_from:from.value?new Date(from.value+'T00:00:00').toISOString():null,p_to:to.value?new Date(new Date(to.value+'T00:00:00').getTime()+86400000).toISOString():null,p_employee:null});
    const sorted=[...rows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));const filtered=()=>sorted.filter(s=>(String(s.employee_name||'')+' '+String(s.fulfillment||'')+' '+String(s.total||'')+' '+String(s.id||'')+' '+dateText(s.created_at)).toLowerCase().includes(search.value.toLowerCase()));
    download.onclick=()=>exportCsv('green-wonderland-sales-history.csv',['Employee','Amount','Items','Fulfillment','Date'],filtered().map(s=>[s.employee_name,s.total,s.item_count,s.fulfillment,s.created_at]));
    const draw=()=>{list.replaceChildren();let total=0;let count=0;for(const s of filtered()){total+=Number(s.total||0);count++;line(list,cash(s.total)+' · '+(s.employee_name||'Unknown employee'),dateText(s.created_at)+' · '+s.item_count+' items · '+s.fulfillment);}status.textContent=count+' recorded sales · '+cash(total)+' total · Newest first';if(!count)line(list,'No matching sales','Try changing your filters.');};search.oninput=draw;draw();
   }catch(e){status.textContent=e.message;}};
   from.onchange=reload;to.onchange=reload;await reload();
  }else if(page==='announcements'){
   if(canFeature('announcements_manage')){
    const form=make('form',undefined,'gw-mdt-form'),title=document.createElement('input'),body=document.createElement('textarea'),submit=make('button','Post Announcement','primary');
    title.placeholder='Announcement title';title.required=true;title.minLength=3;title.maxLength=120;
    body.placeholder='Announcement message';body.required=true;body.minLength=3;body.maxLength=4000;
    form.append(title,body,submit);host.insertBefore(form,status);
    form.onsubmit=async ev=>{ev.preventDefault();submit.disabled=true;try{await rpc('gw_mdt_announcement_create',{p_title:title.value,p_body:body.value});await renderBusinessPage(page,{host,call,token,canFeature,cash,make});}catch(e){status.textContent=e.message;}finally{submit.disabled=false;}};
   }
   const rows=await rpc('gw_mdt_announcements_list'),list=box();status.textContent=rows.length+' announcements';
   for(const a of rows){const row=line(list,a.title,a.body+' · '+a.author+' · '+dateText(a.created_at));if(canFeature('announcements_manage')){const del=make('button','Remove','outline');del.onclick=async()=>{if(!confirm('Remove this announcement?'))return;try{await rpc('gw_mdt_announcement_delete',{p_id:a.id});row.remove();}catch(e){status.textContent=e.message;}};row.append(del);}}
   if(!rows.length)line(list,'No announcements','Updates posted by management will appear here.');
  }else if(page==='notes'){
   const staff=await rpc('gw_mdt_staff_report',{p_feature:'employees'}),picker=document.createElement('select');
   for(const e of staff)picker.add(new Option(e.name,e.id));host.insertBefore(picker,status);
   const list=box();
   const reload=async()=>{list.replaceChildren();if(!picker.value){status.textContent='No employees';return;}try{
    const rows=await rpc('gw_mdt_notes_list',{p_employee:picker.value});status.textContent=rows.length+' private management records';
    for(const n of rows){const card=make('article',undefined,'gw-feature-card');card.append(make('strong',n.category+' · '+n.author),make('p',n.body),make('small',dateText(n.created_at)));list.append(card);}
    if(!rows.length)line(list,'No notes','No management notes recorded for this employee.');
   }catch(e){status.textContent=e.message;}};
   if(canFeature('employee_notes_manage')){
    const form=make('form',undefined,'gw-mdt-form'),category=document.createElement('select'),body=document.createElement('textarea'),submit=make('button','Save Note','primary');
    for(const c of ['General','Recognition','Commendation','Coaching','Verbal Warning','Written Warning','Disciplinary'])category.add(new Option(c,c));
    body.placeholder='Private management note';body.required=true;body.minLength=3;body.maxLength=3000;
    form.append(category,body,submit);host.insertBefore(form,list);
    form.onsubmit=async ev=>{ev.preventDefault();submit.disabled=true;try{await rpc('gw_mdt_note_create',{p_employee:picker.value,p_category:category.value==='Commendation'?'Recognition':['Coaching','Verbal Warning','Written Warning'].includes(category.value)?'Disciplinary':category.value,p_body:['Commendation','Coaching','Verbal Warning','Written Warning'].includes(category.value)?'['+category.value+'] '+body.value:body.value});body.value='';await reload();}catch(e){status.textContent=e.message;}finally{submit.disabled=false;}};
   }
   picker.onchange=reload;await reload();
  }else if(page==='leaderboard'||page==='reports'){
   const rows=await rpc('gw_mdt_sales_report_for_role'),staff=canFeature('dashboard')?await rpc('gw_mdt_staff_report',{p_feature:'dashboard'}):[];
   const list=box(),hours=new Map(staff.map(e=>[e.id,(Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0))/60]));
   if(page==='reports'){
    const cards=make('div',undefined,'gw-mdt-stats');
    for(const [name,key] of [['Today','today_sales'],['This Week','weekly_sales'],['Lifetime','lifetime_sales']]){const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',name+' Sales'),make('strong',cash(rows.reduce((sum,e)=>sum+Number(e[key]||0),0))));cards.append(card);}
    host.insertBefore(cards,list);
    const exportReport=make('button','Export Employee Sales CSV','outline');exportReport.onclick=()=>exportCsv('green-wonderland-employee-sales.csv',['Employee','Role','Today','This Week','Lifetime','Orders'],rows.map(e=>[e.employee_name,e.employee_role,e.today_sales,e.weekly_sales,e.lifetime_sales,e.total_orders]));host.insertBefore(exportReport,list);
    const discord=make('button','Copy Weekly Report for Discord','outline');
    discord.onclick=async()=>{const top=[...rows].sort((a,b)=>Number(b.weekly_sales||0)-Number(a.weekly_sales||0)).slice(0,5);
     const weekly=rows.reduce((sum,e)=>sum+Number(e.weekly_sales||0),0);
     const lines=['**GREEN WONDERLAND | WEEKLY BUSINESS REPORT**','**Week ending:** '+new Date().toLocaleDateString(),'**Weekly sales:** '+cash(weekly),'**Reporting employees:** '+rows.length,'','**Top performers**',...top.map((e,i)=>(i+1)+'. '+e.employee_name+' — '+cash(e.weekly_sales))];
     try{await navigator.clipboard.writeText(lines.join('\\n'));discord.textContent='Copied for Discord!';setTimeout(()=>discord.textContent='Copy Weekly Report for Discord',2200);}catch(e){status.textContent='Unable to copy report: '+e.message;}
    };host.insertBefore(discord,list);
    for(const e of [...rows].sort((a,b)=>Number(b.weekly_sales)-Number(a.weekly_sales)))line(list,e.employee_name,cash(e.weekly_sales)+' this week · '+cash(e.lifetime_sales)+' lifetime · '+e.total_orders+' orders');
   }else{
    const order=document.createElement('select');for(const [label,key] of [['Weekly Sales','weekly_sales'],['Lifetime Sales','lifetime_sales'],['Hours Worked','hours'],['Orders','total_orders']])order.add(new Option(label,key));host.insertBefore(order,list);
    const draw=()=>{list.replaceChildren();const key=order.value;const ranked=[...rows].sort((a,b)=>(key==='hours'?(hours.get(b.employee_id)||0)-(hours.get(a.employee_id)||0):Number(b[key]||0)-Number(a[key]||0)));ranked.forEach((e,i)=>line(list,(i+1)+'. '+e.employee_name,key==='hours'?(hours.get(e.employee_id)||0).toFixed(2)+' hours':key==='total_orders'?e.total_orders+' orders':cash(e[key])));};
    order.onchange=draw;draw();
   }
   status.textContent=rows.length+' employees';
  }
 }catch(e){status.textContent='Unable to load: '+e.message;}
}
