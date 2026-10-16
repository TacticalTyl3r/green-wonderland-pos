import {createSalesChart} from './sales-chart.js?v=2';
import {showAnalytics,showRecognition,showActivitySearch} from './mdt-insights.js?v=audit-detail-20261016';
import {renderBusinessPage} from './business-mdt.js?v=sale-items-20261016';
import {showSaleAdjustments} from './sale-adjustments.js?v=actor-name-fix-20261016';
import {showOffersManager,showProductAnalytics} from './phase4-management.js?v=1';
import {renderLoyaltyManagement} from './loyalty-management.js?v=1';
import {showSecurityCenter,renderEmployeeAchievements,getDashboardSettings,dashboardSettingsEditor,isDashboardWidgetVisible} from './phase3-tools.js?v=1';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY), key='gw-employee-token';
let token=sessionStorage.getItem(key)||'',me=null,employees=[];
const dlg=document.createElement('dialog');dlg.id='gwEmployeeDialog';
dlg.innerHTML=`<div class="dialogHead"><h2>EMPLOYEE TIME CLOCK</h2><button id="gwEmpClose" class="outline">✕</button></div><div id="gwEmpView"></div><p id="gwEmpMsg" role="status"></p>`;
document.body.append(dlg);
const view=dlg.querySelector('#gwEmpView'),msg=s=>dlg.querySelector('#gwEmpMsg').textContent=s;
const clockStatus=document.querySelector('#gwClockStatus');
const quickClock=document.querySelector('#gwQuickClock');
let quickClockBusy=false;
async function quickClockAction(){if(quickClockBusy)return;if(!token||!me){button.click();return;}quickClockBusy=true;quickClock.disabled=true;try{await call('gw_clock',{p_token:token,p_clock_in:!me.clocked_in});await refresh();}catch(e){alert('Time clock: '+e.message);}finally{quickClockBusy=false;quickClock.disabled=false;}}
quickClock?.addEventListener('click',quickClockAction);
const weeklyHours=document.querySelector('#gwWeeklyHours');
async function refreshWeeklyHours(){if(!weeklyHours)return;if(!token||!me){weeklyHours.textContent='This Week: —';return;}try{const hours=await call('gw_my_weekly_hours',{p_token:token});weeklyHours.textContent='This Week: '+Number(hours||0).toFixed(2)+' hrs';}catch(e){weeklyHours.textContent='This Week: unavailable';}}
function updateClockStatus(){if(clockStatus){clockStatus.textContent=me?(me.clocked_in?'● Clocked In · ':'○ Clocked Out · ')+me.employee_name:'○ Not Clocked In';clockStatus.classList.toggle('on-duty',!!me?.clocked_in);clockStatus.classList.toggle('off-duty',!me?.clocked_in);}if(quickClock){quickClock.textContent=me?.clocked_in?'Clock Out':'Clock In';quickClock.classList.toggle('on-duty',!!me?.clocked_in);quickClock.classList.toggle('off-duty',!me?.clocked_in);}}
dlg.querySelector('#gwEmpClose').onclick=()=>dlg.close();
const button=document.createElement('button');button.className='outline';button.textContent='◷ Employee';button.onclick=async()=>{dlg.showModal();await refresh();};document.querySelector('header .actions')?.append(button);
const select=document.createElement('select');select.id='gwSaleEmployee';select.setAttribute('aria-label','Employee credited for this sale');
const holder=document.createElement('div');holder.className='control';holder.innerHTML='<label>Sale credited to</label>';holder.append(select);
document.querySelector('#cartView .checkout')?.before(holder);
async function call(name,args={}){const {data,error}=await db.rpc(name,args);if(error)throw Error(error.message);return data;}
async function roster(){employees=await call('gw_public_employees');select.replaceChildren(new Option('Select employee (required)',''));for(const e of employees)select.add(new Option(e.name,e.id));updateAttribution();}
function updateAttribution(){holder.hidden=!!me;if(me)select.value='';}
async function refresh(){
 view.replaceChildren();msg('');
 try{
 if(token){const rows=await call('gw_pin_me',{p_token:token});me=rows?.[0]||null;if(!me){token='';sessionStorage.removeItem(key);updateClockStatus();}}
 updateClockStatus();await refreshWeeklyHours();
 if(!me){
 const label=document.createElement('label');label.textContent='Employee';
 const employee=document.createElement('select');for(const e of employees)employee.add(new Option(e.name,e.id));label.append(employee);
 const pinLabel=document.createElement('label');pinLabel.textContent='PIN';
 const pin=document.createElement('input');pin.type='password';pin.inputMode='numeric';pin.autocomplete='off';pin.minLength=4;pin.maxLength=12;pinLabel.append(pin);
 const login=document.createElement('button');login.className='primary';login.textContent='Sign in';
 login.onclick=async()=>{login.disabled=true;try{
 const bytes=crypto.getRandomValues(new Uint8Array(32));const next=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const signedIn=await call('gw_pin_login',{p_employee:employee.value,p_pin:pin.value,p_token:next});if(!signedIn?.length)throw Error('Invalid PIN or too many attempts.');
 token=next;sessionStorage.setItem(key,token);await refresh();
 }catch(e){msg(e.message);}finally{login.disabled=false;}};
 view.append(label,pinLabel,login);
 }else{
 const title=document.createElement('h3');title.textContent=`${me.employee_name} • ${me.employee_role}`;
 const status=document.createElement('p');status.textContent=me.clocked_in?'● Currently clocked in':'○ Currently clocked out';
 const clock=document.createElement('button');clock.className='primary';clock.textContent=me.clocked_in?'Clock out':'Clock in';
 clock.onclick=async()=>{clock.disabled=true;try{const result=await call('gw_clock',{p_token:token,p_clock_in:!me.clocked_in});await refresh();msg(result);}catch(e){msg(e.message);clock.disabled=false;}};
 const logout=document.createElement('button');logout.textContent='Sign out';logout.onclick=async()=>{try{await call('gw_pin_logout',{p_token:token});}finally{token='';me=null;sessionStorage.removeItem(key);updateClockStatus();await refresh();}};
 view.append(title,status,clock,logout);
 }
 updateAttribution();window.gwRefreshRoleNavigation?.();
 }catch(e){msg(e.message);}
}
window.gwSelectedEmployee=()=>me?.employee_id||select.value||null;
window.gwRecordSale=async sale=>{
 if(!employees.length)await roster();
 if(token){const rows=await call('gw_pin_me',{p_token:token});me=rows?.[0]||null;if(!me){token='';sessionStorage.removeItem(key);}}
 const selected=me?.employee_id||select.value;
 if(!selected)throw Error('Select the employee responsible for this sale.');
 return await call('gw_record_sale_detailed',{p_token:token||'',p_employee:selected,p_total:sale.total,p_count:sale.count,p_fulfillment:sale.fulfillment,p_items:sale.items||[]});
};
// Store MDT: uses existing Boss-authorized RPCs. No schema change required.
const mdtButton=document.createElement('button');mdtButton.className='outline';mdtButton.textContent='▦ Store MDT';mdtButton.hidden=false;document.querySelector('header .actions')?.append(mdtButton);
const mdt=document.createElement('dialog');mdt.id='gwMdt';mdt.innerHTML='<div class="dialogHead"><div><small>GREEN WONDERLAND / MANAGEMENT</small><h2>STORE MDT</h2></div><button class="outline" id="gwMdtClose">✕</button></div><div class="gw-mdt-layout"><nav class="gw-mdt-sidebar" aria-label="Store MDT navigation"><button type="button" id="gwMdtToggle" class="gw-mdt-toggle" aria-label="Collapse sidebar" aria-expanded="true">☰ <span>Navigation</span></button><div class="gw-mdt-tabs"><button data-page="overview" class="active" title="Overview"><span class="gw-mdt-icon">▦</span><span class="gw-mdt-label">Dashboard</span><span class="gw-mdt-chevron">›</span></button><button data-page="employees" title="Employees"><span class="gw-mdt-icon">♙</span><span class="gw-mdt-label">Employees</span><span class="gw-mdt-chevron">›</span></button><button data-page="time" title="Time Management"><span class="gw-mdt-icon">◷</span><span class="gw-mdt-label">Time Management</span><span class="gw-mdt-chevron">›</span></button><button data-page="sales" title="Sales & Earnings"><span class="gw-mdt-icon">$</span><span class="gw-mdt-label">Sales & Earnings</span><span class="gw-mdt-chevron">›</span></button></div></nav><section class="gw-mdt-main"><div id="gwMdtContent"></div><p id="gwMdtMessage" role="status"></p></section></div>';document.body.append(mdt);
mdt.querySelector('#gwMdtClose').onclick=()=>mdt.close();
const sidebarToggle=mdt.querySelector('#gwMdtToggle');sidebarToggle.onclick=()=>{const collapsed=mdt.classList.toggle('gw-mdt-collapsed');sidebarToggle.setAttribute('aria-expanded',String(!collapsed));sidebarToggle.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');};
const mdtContent=mdt.querySelector('#gwMdtContent'),mdtMessage=mdt.querySelector('#gwMdtMessage');
let mdtPage='overview',staffRows=[],salesRows=[],bossAllowed=false;
let grantedFeatures=new Set();
let timeHistoryRows=[],activityRows=[],mdtTab='hours',employeeSearch='';
const canFeature=feature=>bossAllowed||grantedFeatures.has(feature);
const formatHours=n=>(Number(n||0)/60).toFixed(2);
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
async function checkBoss(){try{const {data:{session}}=await db.auth.getSession();if(!session){bossAllowed=false;}else{const {data,error}=await db.rpc('gw_is_boss');bossAllowed=!error&&data===true;}mdtButton.hidden=false;}catch(e){bossAllowed=false;mdtButton.hidden=false;}return bossAllowed;}
window.gwEmployeeProfileImages={};
async function loadRosterPhotos(){try{const {data,error}=await db.rpc('gw_employee_profile_images',{p_token:token||''});if(error)throw error;window.gwEmployeeProfileImages=Object.fromEntries((data||[]).map(x=>[String(x.employee_id),x.profile_image_url]));}catch(e){console.warn('Roster profile pictures unavailable:',e.message);}}
async function loadStaff(page=mdtPage){const feature=page==='time'?'time_management':page==='employees'?'employees':'dashboard';staffRows=await call('gw_mdt_staff_report',{p_token:token||'',p_feature:feature});await loadRosterPhotos();return staffRows;}
async function loadSales(){salesRows=await call('gw_mdt_sales_report_for_role',{p_token:token||''});}
const cash=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
function renderSales(){
 const cards=make('div',undefined,'gw-mdt-stats');
 for(const [label,key] of [['Today','today_sales'],['This Week','weekly_sales'],['Lifetime','lifetime_sales']]){
 const box=make('div',undefined,'gw-mdt-stat');
 box.append(make('small',label+' Sales / Earnings'),make('strong',cash(salesRows.reduce((a,e)=>a+Number(e[key]||0),0))));
 cards.append(box);
 }
 mdtContent.append(cards,make('h3','Employee Sales & Earnings'),make('p','Employees earn 100% of recorded sales. Weekly reporting starts Monday. Figures are based on browser-submitted sales.'));
 const list=make('div',undefined,'gw-mdt-roster');
 const ranked=[...salesRows].sort((a,b)=>Number(b.lifetime_sales)-Number(a.lifetime_sales));
 ranked.forEach((e,i)=>{
 const row=make('div',undefined,'gw-mdt-employee'),details=make('div'),amounts=make('div',undefined,'gw-mdt-sales-figures');
 details.append(make('strong',(i+1)+'. '+e.employee_name),make('p',e.employee_role+' · '+e.total_orders+' orders'));
 for(const [label,key] of [['Today','today_sales'],['Week','weekly_sales'],['Lifetime','lifetime_sales']]){const item=make('div');item.append(make('small',label),make('strong',cash(e[key])));amounts.append(item);}
 row.append(details,amounts);list.append(row);
 });
 if(!ranked.length)list.append(make('p','No employees found.'));
 mdtContent.append(list);
 if(ranked.length){
  const leaders=make('section',undefined,'gw-leader-panel');leaders.append(make('h3','Top Employees by Sales'));
  const max=Math.max(1,...ranked.map(x=>Number(x.weekly_sales||0)));
  ranked.slice(0,5).forEach((e,i)=>{const item=make('div',undefined,'gw-leader-item');const caption=make('div',undefined,'gw-leader-caption');caption.append(make('span',(i+1)+'. '+e.employee_name),make('strong',cash(e.weekly_sales)));const track=make('div',undefined,'gw-leader-track'),fill=make('div',undefined,'gw-leader-fill');fill.style.width=(100*Number(e.weekly_sales||0)/max)+'%';track.append(fill);item.append(caption,track);leaders.append(item);});
  mdtContent.append(leaders);
 }
}
async function renderEmployeeSalesTrend(e,host){
 host.replaceChildren(make('p','Loading 30-day sales trend…'));
 try{
  const rows=await call('gw_mdt_employee_sales_trend',{p_token:token||'',p_employee:e.id});
  host.replaceChildren();
  const values=new Map(rows.map(r=>[r.day.slice(0,10),{sales:Number(r.sales||0),orders:Number(r.orders||0)}]));
  const days=[];const today=new Date();const utcToday=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate());
  for(let offset=29;offset>=0;offset--){const day=new Date(utcToday-offset*86400000).toISOString().slice(0,10);days.push({day,...(values.get(day)||{sales:0,orders:0})});}
  host.append(createSalesChart(days,{cash,height:150}));
  host.append(make('p','Last 30 days · Hover, tap, or use Tab to inspect a date.'));

 }catch(err){host.replaceChildren(make('p','Sales trend unavailable: '+err.message));}
}
function employeeProfile(e){
 mdtContent.replaceChildren();
 const back=make('button','← Back to Employees','outline');back.onclick=()=>renderMdt();
 const header=make('div',undefined,'gw-mdt-head');header.append(make('h2',e.name),make('p',e.role+' · '+(e.active?'Active':'Inactive')));
 const cards=make('div',undefined,'gw-mdt-stats');
 const sale=salesRows.find(s=>s.employee_id===e.id);
 for(const [label,value] of [['Total Hours',formatHours(Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0))],['Hours This Week','Loading…'],['Weekly Sales',sale?cash(sale.weekly_sales):'Not available'],['Shift Status',e.clocked_in?'Clocked In':'Clocked Out'],['Lifetime Sales',sale?cash(sale.lifetime_sales):'Not available'],['Total Orders',sale?String(sale.total_orders):'Not available']]){
  const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',value));cards.append(card);
 }
 mdtContent.append(back,header,cards);
 if(canFeature('employees')){const weeklyCard=[...cards.children].find(card=>card.querySelector('small')?.textContent==='Hours This Week');call('gw_mdt_employee_weekly_hours',{p_token:token||'',p_employee:e.id}).then(hours=>{if(weeklyCard)weeklyCard.querySelector('strong').textContent=Number(hours||0).toFixed(2)+' hrs';}).catch(()=>{if(weeklyCard)weeklyCard.querySelector('strong').textContent='Unavailable';});}
 if(canFeature('sales_earnings')){const trend=make('div');mdtContent.append(make('h3','Sales Performance · Last 30 Days'),trend);renderEmployeeSalesTrend(e,trend);}
 if(canFeature('recognition_view')||canFeature('recognition_manage')){const recognitionHost=make('div');mdtContent.append(make('h3','Employee Recognition'),recognitionHost);showRecognition(recognitionHost,e,{call,token:()=>token||'',canFeature,make});}
 const actions=make('div',undefined,'gw-mdt-actions');
 if(canFeature('employee_notes')||canFeature('employee_notes_manage')){const notes=make('h3','Management Notes');mdtContent.append(notes);const noteHost=make('div');mdtContent.append(noteHost);renderEmployeeNotes(e,noteHost);}
 if(['employee_edit','employee_deactivate','employee_role_assign','employee_pin_reset'].some(canFeature)){const edit=make('button','Edit Employee','outline');edit.onclick=()=>employeeForm(e);actions.append(edit);}
 if(canFeature('time_add')||canFeature('time_remove')){const adjust=make('button','Adjust Time','outline');adjust.onclick=()=>adjustTime(e);actions.append(adjust);}
 mdtContent.append(actions);
}
async function renderEmployeeNotes(e,host){
 host.replaceChildren(make('p','Loading private notes…'));
 try{
  const notes=await call('gw_mdt_notes_list',{p_token:token||'',p_employee:e.id});
  host.replaceChildren();
  if(canFeature('employee_notes_manage')){
   const form=make('form',undefined,'gw-mdt-form'),category=document.createElement('select'),body=document.createElement('textarea'),submit=make('button','Add Note','primary');
   for(const kind of ['General','Recognition','Commendation','Coaching','Verbal Warning','Written Warning','Disciplinary'])category.add(new Option(kind,kind));
   body.placeholder='Private employee note';body.required=true;body.minLength=3;body.maxLength=3000;
   form.append(category,body,submit);host.append(form);
   form.onsubmit=async ev=>{ev.preventDefault();submit.disabled=true;try{await call('gw_mdt_note_create',{p_token:token||'',p_employee:e.id,p_category:category.value==='Commendation'?'Recognition':['Coaching','Verbal Warning','Written Warning'].includes(category.value)?'Disciplinary':category.value,p_body:['Commendation','Coaching','Verbal Warning','Written Warning'].includes(category.value)?'['+category.value+'] '+body.value:body.value});await renderEmployeeNotes(e,host);}catch(err){mdtMessage.textContent=err.message;}finally{submit.disabled=false;}};
  }
  const list=make('div',undefined,'gw-mdt-roster');
  for(const n of notes){const card=make('article',undefined,'gw-feature-card');card.append(make('strong',n.category+' · '+n.author),make('p',n.body),make('small',new Date(n.created_at).toLocaleString()));list.append(card);}
  if(!notes.length)list.append(make('p','No employee notes yet.'));
  host.append(list);
 }catch(err){host.replaceChildren(make('p','Unable to load notes: '+err.message));}
}
function employeeForm(e){
 const form=make('form',undefined,'gw-mdt-form');
 const title=make('h3',e?'Edit Employee':'Add Employee');form.append(title);
 const field=(label,input)=>{const l=make('label',label);l.append(input);form.append(l);return input;};
 const name=field('Employee name',document.createElement('input'));name.required=true;name.maxLength=100;name.value=e?.name||'';name.disabled=!!e&&!canFeature('employee_edit');
 const role=document.createElement('select');for(const r of ['Boss','Manager','Senior Salesman','Salesman'])role.add(new Option(r,r));role.value=e?.role||'Salesman';role.disabled=!!e&&!canFeature('employee_role_assign');field('Position',role);
 const pin=field(e?'New PIN (leave blank to keep existing)':'Employee PIN (4–12 digits)',document.createElement('input'));pin.type='password';pin.inputMode='numeric';pin.minLength=4;pin.maxLength=12;pin.pattern='[0-9]{4,12}';pin.required=!e;pin.disabled=!!e&&!canFeature('employee_pin_reset');pin.autocomplete='new-password';
 const active=document.createElement('input');active.type='checkbox';active.checked=e?e.active!==false:true;active.disabled=!!e&&!canFeature('employee_deactivate');field('Active employee',active);
 const actions=make('div',undefined,'gw-mdt-actions');const save=make('button','Save Employee','primary');save.type='submit';const cancel=make('button','Cancel','outline');cancel.type='button';cancel.onclick=()=>renderMdt();actions.append(save,cancel);form.append(actions);
 form.onsubmit=async ev=>{ev.preventDefault();save.disabled=true;mdtMessage.textContent='Saving employee…';try{await call('gw_mdt_manage_employee',{p_token:token||'',p_id:e?.id||null,p_name:name.value.trim(),p_role:role.value,p_pin:pin.value||null,p_active:active.checked});await roster();await loadStaff();mdtMessage.textContent='Employee saved.';renderMdt();}catch(err){mdtMessage.textContent=err.message;}finally{save.disabled=false;}};
 mdtContent.replaceChildren(form);name.focus();
}
async function adjustTime(e){
 const form=make('form',undefined,'gw-mdt-form gw-time-adjust-form');form.append(make('h2','Adjust Employee Hours'));
 const employee=make('label','Employee');const name=make('strong',e.name,'gw-time-employee');employee.append(name);form.append(employee);
 const hoursSummary=make('div',undefined,'gw-mdt-stats');
 const total=Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0);
 for(const [label,value] of [['Recorded Hours',formatHours(Number(e.worked_minutes||0))],['Adjusted Total',formatHours(total)]]){const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',value));hoursSummary.append(card);}form.append(hoursSummary);
 const type=make('div',undefined,'gw-time-type');const add=make('button','Add Time','active'),remove=make('button','Remove Time');add.type=remove.type='button';let sign=1;
 const toggle=value=>{sign=value;add.classList.toggle('active',sign===1);remove.classList.toggle('active',sign===-1);};add.onclick=()=>toggle(1);remove.onclick=()=>toggle(-1);type.append(add,remove);form.append(make('label','Adjustment Type'),type);
 const fields=make('div',undefined,'gw-time-fields');const hrs=document.createElement('input'),mins=document.createElement('input');hrs.type=mins.type='number';hrs.min='0';mins.min='0';mins.max='59';hrs.step=mins.step='1';hrs.value='0';mins.value='30';for(const [label,input] of [['Hours',hrs],['Minutes',mins]]){const field=make('label',label);field.append(input);fields.append(field);}form.append(fields);
 const reason=document.createElement('textarea');reason.required=true;reason.minLength=5;reason.maxLength=500;reason.placeholder='Example: Employee forgot to clock in';const reasonLabel=make('label','Reason for Adjustment');reasonLabel.append(reason);form.append(reasonLabel);
 const actions=make('div',undefined,'gw-mdt-actions'),save=make('button','Save Time Adjustment','primary'),cancel=make('button','Cancel','outline');save.type='submit';cancel.type='button';cancel.onclick=()=>renderMdt();actions.append(save,cancel);form.append(actions);
 form.onsubmit=async ev=>{ev.preventDefault();const h=Number(hrs.value),m=Number(mins.value);if(!Number.isSafeInteger(h)||!Number.isSafeInteger(m)||h<0||m<0||m>59||h*60+m===0){mdtMessage.textContent='Enter valid hours and minutes greater than zero.';return;}const value=sign*(h*60+m);if(!canFeature(value>0?'time_add':'time_remove')){mdtMessage.textContent='You do not have permission for this adjustment.';return;}save.disabled=true;try{await call('gw_mdt_adjust_time',{p_token:token||'',p_employee:e.id,p_minutes:value,p_reason:reason.value.trim()});await loadStaff();mdtMessage.textContent='Time adjustment saved with reason.';renderMdt();}catch(err){mdtMessage.textContent=err.message;}finally{save.disabled=false;}};
 mdtContent.replaceChildren(form);
}
async function showActivityLog(){
 mdtContent.replaceChildren(make('h2','Management Activity'));
 const back=make('button','← Dashboard','outline');back.onclick=()=>renderMdt();mdtContent.append(back);
 mdtMessage.textContent='Loading activity…';
 try{
  activityRows=await call('gw_mdt_activity_report',{p_token:token||''});
  const list=make('div',undefined,'gw-mdt-roster');
  for(const a of activityRows){const row=make('div',undefined,'gw-mdt-employee'),info=make('div');info.append(make('strong',a.action+' · '+a.subject),make('p',(a.details||'')+' · '+new Date(a.created_at).toLocaleString()));row.append(info);list.append(row);}
  if(!activityRows.length)list.append(make('p','No activity recorded yet.'));
  mdtContent.append(list);mdtMessage.textContent='';
 }catch(err){mdtMessage.textContent='Activity log unavailable: '+err.message;}
}
async function showTimeHistory(){
 mdtTab='history';mdtContent.replaceChildren(make('h2','Time Adjustment History'),make('p','Review employee hour adjustments, reasons, and who made each change.','gw-history-intro'));
 const back=make('button','← Employee Hours','outline');back.onclick=()=>{mdtTab='hours';renderMdt();};mdtContent.append(back);
 mdtMessage.textContent='Loading adjustment history…';
 try{
  timeHistoryRows=await call('gw_mdt_time_history',{p_token:token||''});
  const search=document.createElement('input');search.placeholder='Search employee, manager or reason';mdtContent.append(search);
  const list=make('div',undefined,'gw-mdt-roster');mdtContent.append(list);
  const draw=()=>{list.replaceChildren();const q=search.value.trim().toLowerCase();for(const a of timeHistoryRows.filter(a=>(a.employee_name+' '+a.actor_name+' '+a.reason).toLowerCase().includes(q))){const row=make('div',undefined,'gw-mdt-employee gw-history-entry '+(a.minutes>0?'gw-history-added':a.minutes<0?'gw-history-removed':'gw-history-neutral'));const detail=make('div',undefined,'gw-history-details');detail.append(make('strong',a.employee_name),make('p',a.reason||'No reason provided'),make('small','By '+a.actor_name+' · '+new Date(a.created_at).toLocaleString()));const badge=make('div',undefined,'gw-history-amount');badge.append(make('strong',(a.minutes>0?'+':a.minutes<0?'−':'')+Math.abs(a.minutes)+' min'),make('small',a.minutes>0?'TIME ADDED':a.minutes<0?'TIME REMOVED':'NO CHANGE'));row.append(detail,badge);list.append(row);}if(!list.children.length)list.append(make('p','No matching adjustments.'));};
  search.oninput=draw;draw();mdtMessage.textContent='';
 }catch(err){mdtMessage.textContent='History unavailable: '+err.message;}
}
async function renderDashboardAnnouncements(host){
 host.replaceChildren(make('p','Loading announcements…'));
 try{
  const rows=await call('gw_mdt_announcements_list',{p_token:token||''});
  host.replaceChildren();
  if(canFeature('announcements_manage')){
   const form=make('form',undefined,'gw-mdt-form'),title=document.createElement('input'),body=document.createElement('textarea'),submit=make('button','Post Announcement','primary');
   title.placeholder='Announcement title';title.required=true;title.minLength=3;title.maxLength=120;
   body.placeholder='Announcement message';body.required=true;body.minLength=3;body.maxLength=4000;
   form.append(title,body,submit);host.append(form);
   form.onsubmit=async ev=>{ev.preventDefault();submit.disabled=true;try{await call('gw_mdt_announcement_create',{p_token:token||'',p_title:title.value,p_body:body.value});await renderDashboardAnnouncements(host);}catch(err){mdtMessage.textContent=err.message;}finally{submit.disabled=false;}};
  }
  const list=make('div',undefined,'gw-mdt-roster');
  for(const a of rows){const row=make('div',undefined,'gw-mdt-employee'),info=make('div');info.append(make('strong',a.title),make('p',a.body+' · '+a.author+' · '+new Date(a.created_at).toLocaleString()));row.append(info);
   if(canFeature('announcements_manage')){const remove=make('button','Remove','outline');remove.onclick=async()=>{if(!confirm('Remove this announcement?'))return;try{await call('gw_mdt_announcement_delete',{p_token:token||'',p_id:a.id});await renderDashboardAnnouncements(host);}catch(err){mdtMessage.textContent=err.message;}};row.append(remove);}
   list.append(row);
  }
  if(!rows.length)list.append(make('p','No announcements posted yet.'));
  host.append(list);
 }catch(err){host.replaceChildren(make('p','Unable to load announcements: '+err.message));}
}
let dashboardPrefsOpen=false;
async function showNotifications(host=mdtContent){
 host.replaceChildren();
 const heading=make('div',undefined,'gw-mdt-head');heading.append(make('h2','Notifications'),make('p','Company announcements and important updates.'));
 host.append(heading);
 const toolbar=make('div',undefined,'gw-mdt-actions'),list=make('div',undefined,'gw-mdt-roster'),status=make('p','');
 host.append(toolbar,status,list);
 if(canFeature('announcements_manage')){
  const add=make('button','+ New Announcement','primary');toolbar.append(add);
  add.onclick=()=>{
   const form=make('form',undefined,'gw-mdt-form'),title=document.createElement('input'),body=document.createElement('textarea'),submit=make('button','Post Announcement','primary'),cancel=make('button','Cancel','outline');
   title.placeholder='Announcement title';title.required=true;title.maxLength=120;body.placeholder='Write your announcement';body.required=true;body.maxLength=4000;
   submit.type='submit';cancel.type='button';cancel.onclick=()=>form.remove();
   form.append(title,body,submit,cancel);toolbar.after(form);title.focus();
   form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;status.textContent='Posting announcement…';try{
    await call('gw_mdt_announcement_create',{p_token:token||'',p_title:title.value.trim(),p_body:body.value.trim()});
    await showNotifications(host);
   }catch(e){status.textContent='Could not post announcement: '+e.message;submit.disabled=false;}};
  };
 }
 try{
  const rows=await call('gw_mdt_announcements_list',{p_token:token||''});
  const seenKey='gw-notifications-seen-'+String(me?.employee_id||'guest');
  let seen=[];try{seen=JSON.parse(localStorage.getItem(seenKey)||'[]');if(!Array.isArray(seen))seen=[];}catch(e){}
  const idOf=a=>String(a.id||a.created_at+'-'+a.title);
  const updateCount=()=>{const unread=(rows||[]).filter(a=>!seen.includes(idOf(a))).length;status.textContent=(rows?.length||0)+' announcements · '+unread+' unread on this browser';};
  updateCount();
  if(!rows?.length){list.append(make('p','No announcements yet.'));return;}
  for(const item of rows){
   const card=make('article',undefined,'gw-feature-card gw-notice-card');
   if(!seen.includes(idOf(item)))card.classList.add('gw-notice-unread');
   const title=make('div',undefined,'gw-notice-heading');title.append(make('strong',item.title||'Announcement'));
   const mark=make('button',seen.includes(idOf(item))?'Read':'Mark as Read','outline');
   mark.disabled=seen.includes(idOf(item));mark.onclick=()=>{seen.push(idOf(item));localStorage.setItem(seenKey,JSON.stringify([...new Set(seen)].slice(-1000)));card.classList.remove('gw-notice-unread');mark.textContent='Read';mark.disabled=true;updateCount();};
   title.append(mark);card.append(title,make('p',item.body||''),make('small',(item.author||'Management')+' · '+new Date(item.created_at).toLocaleString()));
   list.append(card);
  }
 }catch(e){status.textContent='Unable to load announcements: '+e.message;}
}
function renderMdt(){
 mdtContent.replaceChildren();
 if(mdtPage==='time'){const clockCard=make('div',undefined,'gw-mdt-stat');clockCard.append(make('h3','Employee Time Clock'),make('p',me?(me.employee_name+' · '+(me.clocked_in?'Clocked In':'Clocked Out')):'Sign in with your employee PIN to clock in or out.'));const openClock=make('button','Open Time Clock','primary');openClock.onclick=()=>button.click();clockCard.append(openClock);mdtContent.append(clockCard);if(canFeature('time_history')){const history=make('button','Adjustment History','outline');history.onclick=showTimeHistory;mdtContent.append(history);}}
 const active=staffRows.filter(e=>e.active!==false),onDuty=active.filter(e=>e.clocked_in).length;
 if(mdtPage==='sales'){renderSales();}else if(mdtPage==='overview'){
  const actor=me?.employee_id||'guest';
  const head=make('div',undefined,'gw-mdt-head');
  head.append(make('h2','Store Dashboard'),make('p','Your store at a glance, with personalized sections.'));
  const customize=make('button','⚙ Customize Dashboard','outline');head.append(customize);mdtContent.append(head);
  const preferences=make('div');mdtContent.append(preferences);
  customize.onclick=()=>{dashboardPrefsOpen=!dashboardPrefsOpen;renderMdt();};
  if(dashboardPrefsOpen)dashboardSettingsEditor(preferences,{employeeId:actor,make,refresh:()=>renderMdt()});
  const sections=new Map();
  const section=(id,cls)=>{const host=make('section',undefined,'gw-dashboard-widget '+(cls||''));sections.set(id,host);return host;};
  if(canFeature('announcements')||canFeature('announcements_manage')){const host=section('notifications','gw-dashboard-notifications');showNotifications(host);}
  const stats=section('stats');
  const cards=make('div',undefined,'gw-mdt-stats');
  for(const [label,value] of [['Active Employees',active.length],['Currently Clocked In',onDuty],['Recorded Staff Hours',formatHours(staffRows.reduce((sum,e)=>sum+Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0),0))],...(canFeature('sales_earnings')?[['Sales This Week',cash(salesRows.reduce((sum,e)=>sum+Number(e.weekly_sales||0),0))],['Top Seller',salesRows.length?[...salesRows].sort((a,b)=>Number(b.weekly_sales||0)-Number(a.weekly_sales||0))[0].employee_name:'None']]:[] )]){const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',String(value)));cards.append(card);}stats.append(cards);
  const working=section('working');
  const duty=staffRows.filter(e=>e.clocked_in);working.append(make('h3','Currently Working'),make('p',duty.length?duty.map(e=>e.name).join(' · '):'No employees currently clocked in.'));
  if(canFeature('sales_earnings')){
   const performers=section('performers');performers.append(make('h3','Top Performers This Week'));
   const top=[...salesRows].sort((a,b)=>Number(b.weekly_sales||0)-Number(a.weekly_sales||0)).slice(0,3);
   if(!top.length)performers.append(make('p','No recorded sales yet.'));
   for(const [i,e] of top.entries())performers.append(make('p',(i+1)+'. '+e.employee_name+' · '+cash(e.weekly_sales)));
  }
  if(canFeature('recognition_view')||canFeature('recognition_manage')){
   const awards=section('recognition');awards.append(make('h3','Recent Recognition'));
   const target=make('div');awards.append(target);showRecognition(target,null,{call,token:()=>token||'',canFeature,make});
  }
  if(canFeature('employees')){
   const achievements=section('achievements');achievements.append(make('h3','Employee Achievements'));
   const grid=make('div');achievements.append(grid);renderEmployeeAchievements(grid,{staff:staffRows,sales:salesRows,make,cash});
  }
  for(const id of getDashboardSettings(actor)){const host=sections.get(id);if(host&&isDashboardWidgetVisible(actor,id))mdtContent.append(host);}

 }else{
  const head=make('div',undefined,'gw-mdt-head');head.append(make('h3',mdtPage==='employees'?'Employee Roster':'Employee Hours'));
  if(mdtPage==='employees'&&canFeature('employee_add')){const add=make('button','+ Add Employee','primary');add.onclick=()=>employeeForm();head.append(add);}mdtContent.append(head);
  if(mdtPage==='employees'){const search=document.createElement('input');search.type='search';search.placeholder='Search employees by name or position';search.value=employeeSearch;search.oninput=()=>{employeeSearch=search.value;renderMdt();const field=mdtContent.querySelector('input[type=search]');field?.focus();field?.setSelectionRange(employeeSearch.length,employeeSearch.length);};mdtContent.append(search);}
  const table=make('div',undefined,mdtPage==='employees'?'gw-mdt-roster gw-roster-groups':'gw-mdt-roster');
  const ranks=['Boss','Manager','Senior Salesman','Salesman'];const grouped={};
  if(mdtPage==='employees'){for(const rank of ranks){const section=make('section',undefined,'gw-roster-section');section.append(make('h3',rank));const grid=make('div',undefined,'gw-roster-grid');section.append(grid);grouped[rank]=grid;table.append(section);}}

  for(const e of [...staffRows].sort((a,b)=>{const ranks=['Boss','Manager','Senior Salesman','Salesman'];return ranks.indexOf(a.role)-ranks.indexOf(b.role)||a.name.localeCompare(b.name);}).filter(e=>mdtPage!=='employees'||(e.name+' '+e.role).toLowerCase().includes(employeeSearch.toLowerCase()))){const row=make('div',undefined,mdtPage==='employees'?'gw-mdt-employee gw-roster-card':'gw-mdt-employee');const info=make('div');if(mdtPage==='employees'){const avatar=make('span',e.name.split(/\s+/).map(part=>part[0]||'').slice(0,2).join('').toUpperCase(),'gw-roster-avatar');const url=window.gwEmployeeProfileImages?.[String(e.id)];if(url){const photo=document.createElement('img');photo.src=url;photo.alt=e.name+' profile picture';photo.className='gw-roster-photo';photo.onerror=()=>{photo.remove();avatar.hidden=false;};avatar.hidden=true;info.append(photo);}info.append(avatar);}if(mdtPage==='employees'){const profile=make('button',e.name,'outline');profile.onclick=async()=>{try{if(canFeature('sales_earnings'))await loadSales();else salesRows=[];employeeProfile(e);}catch(err){mdtMessage.textContent=err.message;employeeProfile(e);}};info.append(profile);}else info.append(make('strong',e.name));info.append(make('p',e.role+' · '+(e.active===false?'Inactive':e.clocked_in?'On duty':'Off duty')+' · '+formatHours(Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0))+' hours'));const actions=make('div',undefined,'gw-mdt-actions');if(mdtPage==='employees'&&['employee_edit','employee_deactivate','employee_role_assign','employee_pin_reset'].some(canFeature)){const edit=make('button','Edit / PIN','outline');edit.onclick=()=>employeeForm(e);actions.append(edit);}if(canFeature('time_add')||canFeature('time_remove')){const adjust=make('button','Adjust Time','outline');adjust.onclick=()=>adjustTime(e);actions.append(adjust);}row.append(info,actions);(mdtPage==='employees'?(grouped[e.role]||grouped['Salesman']):table).append(row);}if(mdtPage==='employees'){for(const section of [...table.children])if(!section.querySelector('.gw-roster-card'))section.remove();}if(!staffRows.length)table.append(make('p','No employees found. Add your first employee to get started.'));mdtContent.append(table);
 }
}
async function switchPage(page){mdtPage=page;mdt.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));if(page==='sales'){mdtMessage.textContent='Loading sales…';try{await loadSales();mdtMessage.textContent='';}catch(e){mdtContent.replaceChildren();mdtMessage.textContent='Sales report unavailable: '+e.message;return;}}renderMdt();}
mdt.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>switchPage(b.dataset.page));
mdtButton.onclick=async()=>{mdt.showModal();mdtMessage.textContent='Checking management access…';if(!await checkBoss()){mdtContent.replaceChildren(make('h3','Management sign-in required'),make('p','Sign in using the Admin button with your Boss account, then reopen Store MDT. If already signed in, sign out and sign back in to refresh your session.'));mdtMessage.textContent='Your current website session does not have Boss access.';return;}mdtMessage.textContent='Loading employees…';try{await loadStaff();mdtMessage.textContent='';switchPage('overview');}catch(e){mdtMessage.textContent=e.message;}};
document.querySelector('#adminBtn')?.addEventListener('click',()=>setTimeout(checkBoss,400));
document.querySelector('#login')?.addEventListener('click',()=>setTimeout(checkBoss,800));
document.querySelector('#logout')?.addEventListener('click',()=>{bossAllowed=false;mdtButton.hidden=false;mdt.close();});
db.auth.onAuthStateChange(()=>setTimeout(checkBoss,0));
checkBoss();
roster().then(refresh).catch(e=>{msg('Employee service not configured yet: '+e.message);holder.hidden=true;});


/* Boss-configurable role permission editor */
const roleFeatures=[['dashboard','Dashboard'],['employees','Employees'],['time_management','Time Management'],['sales_earnings','Sales & Earnings'],['admin_catalog','Products & Settings'],['admin_branding','Branding & Images'],['employee_add','Add Employees'],['employee_edit','Edit Employees'],['employee_deactivate','Deactivate Employees'],['employee_role_assign','Assign Roles'],['employee_pin_reset','Reset PINs'],['time_add','Add Work Time'],['time_remove','Remove Work Time'],['time_history','View Time History'],['sales_history','Sales History'],['sales_adjust','Refund / Void Sales'],['offers_manage','Manage Bundles & Specials'],['loyalty_view','View Loyalty Members'],['loyalty_adjust','Adjust Loyalty Points'],['announcements','View Announcements'],['announcements_manage','Manage Announcements'],['employee_notes','View Employee Notes'],['employee_notes_manage','Manage Employee Notes'],['recognition_view','View Recognition'],['recognition_manage','Award Recognition'],['activity_history','View Activity History']];
async function showRolePermissions(){
 mdtContent.replaceChildren();
 const intro=make('div',undefined,'gw-permissions-intro');
 intro.innerHTML='<small>GREEN WONDERLAND · BOSS PANEL</small><h2>Role Permissions</h2><p>Choose what each position can access within the MDT. Boss retains full access.</p>';
 mdtContent.append(intro);
 mdtMessage.textContent='Loading permissions…';
 try{
  const records=await call('gw_mdt_role_permissions_admin');
  const roles=['Manager','Senior Salesman','Salesman'];
  const descriptions={
   dashboard:'View the store dashboard and summary information',employees:'View employee records and roster information',
   time_management:'Access time clock and management tools',sales_earnings:'View sales performance and employee earnings',
   admin_catalog:'Edit products, prices, ingredients and images',admin_branding:'Update branding, images and store appearance',
   employee_add:'Create new employee accounts',employee_edit:'Update employee information',employee_deactivate:'Deactivate employee accounts',
   employee_role_assign:'Change employee positions',employee_pin_reset:'Reset employee PINs',
   time_add:'Add work time to employee records',time_remove:'Remove work time from employee records',
   time_history:'Review historical time adjustments',sales_history:'View customer order and sales history',sales_adjust:'Authorize partial refunds and voids with required reasons',offers_manage:'Create, edit and disable product bundles and specials',loyalty_view:'View loyalty customers, point balances and reward history',loyalty_adjust:'Add or remove loyalty points with a recorded reason',
   announcements:'Read store announcements',announcements_manage:'Create and manage announcements',
   employee_notes:'View employee notes',employee_notes_manage:'Add and manage employee notes',
   recognition_view:'View employee recognition',recognition_manage:'Award employee recognition',
   activity_history:'Review MDT administrative activity'
  };
  const icons={dashboard:'▥',employees:'♙',time_management:'◷',sales_earnings:'▥',admin_catalog:'▣',admin_branding:'✦',employee_add:'+',employee_edit:'✎',employee_deactivate:'⊘',employee_role_assign:'♛',employee_pin_reset:'⚿',time_add:'+',time_remove:'−',time_history:'◷',sales_history:'▤',announcements:'◈',announcements_manage:'✎',employee_notes:'▤',employee_notes_manage:'✎',recognition_view:'★',recognition_manage:'★',activity_history:'◷'};
  const selectorPanel=make('section',undefined,'gw-permissions-select-panel');
  const selectorLabel=make('label','SELECT POSITION','gw-permissions-select-label');
  const selector=document.createElement('select');selector.className='gw-role-selector';selector.setAttribute('aria-label','Select position');
  roles.forEach(role=>selector.add(new Option(role,role)));
  selectorLabel.append(selector);selectorPanel.append(selectorLabel);mdtContent.append(selectorPanel);
  const panel=make('section',undefined,'gw-permissions-panel');
  const panelHead=make('div',undefined,'gw-permissions-panel-head');
  panelHead.append(make('h3','◈  Permissions'),make('p','Enable or disable what this position can access.'));
  panel.append(panelHead);
  const list=make('div',undefined,'gw-permissions-list');panel.append(list);mdtContent.append(panel);
  const footer=make('div',undefined,'gw-permissions-footer');
  const cancel=make('button','↺  Discard Changes','gw-permissions-cancel');cancel.type='button';
  const save=make('button','▣  Save Permissions','gw-permissions-save');save.type='button';
  footer.append(cancel,save);mdtContent.append(footer);
  let pending=new Map(),initial=new Map();
  function populate(){
   list.replaceChildren();pending=new Map();initial=new Map();
   const role=selector.value;
   for(const [feature,label] of roleFeatures){
    const entry=records.find(x=>x.role===role&&x.feature===feature);
    const enabled=entry?.allowed===true;
    initial.set(feature,enabled);pending.set(feature,enabled);
    const row=make('label',undefined,'gw-permissions-item');
    const badge=make('span',icons[feature]||'◆','gw-permissions-icon');
    const detail=make('span',undefined,'gw-permissions-detail');
    detail.append(make('strong',label),make('small',descriptions[feature]||'Control access to this feature.'));
    const control=make('span',undefined,'gw-permissions-control');
    const input=document.createElement('input');input.type='checkbox';input.checked=enabled;input.className='gw-permissions-checkbox';input.setAttribute('aria-label',label);
    const track=make('span',undefined,'gw-permissions-track');
    const state=make('span',enabled?'On':'Off','gw-permissions-state');
    input.onchange=()=>{pending.set(feature,input.checked);state.textContent=input.checked?'On':'Off';mdtMessage.textContent='Unsaved changes · Click Save Permissions to apply.';};
    control.append(input,track,state);row.append(badge,detail,control);list.append(row);
   }
   mdtMessage.textContent='';
  }
  selector.onchange=populate;
  cancel.onclick=populate;
  save.onclick=async()=>{
   const role=selector.value;
   const changed=[...pending].filter(([key,value])=>value!==initial.get(key));
   if(!changed.length){mdtMessage.textContent='No changes to save.';return;}
   save.disabled=true;selector.disabled=true;cancel.disabled=true;
   let count=0;
   try{
    for(const [feature,allowed] of changed){
     await call('gw_mdt_set_role_permission',{p_role:role,p_feature:feature,p_allowed:allowed});
     const entry=records.find(x=>x.role===role&&x.feature===feature);
     if(entry)entry.allowed=allowed;else records.push({role,feature,allowed});
     initial.set(feature,allowed);count++;
    }
    mdtMessage.textContent='Saved '+count+' permission'+(count===1?'':'s')+' for '+role+'.';
   }catch(e){mdtMessage.textContent='Saved '+count+' of '+changed.length+' changes. Error: '+e.message;}
   finally{save.disabled=false;selector.disabled=false;cancel.disabled=false;}
  };
  populate();
 }catch(e){mdtMessage.textContent='Permissions unavailable: '+e.message;}
}
/* Full-page Store MDT navigation and permission-aware menu */
const siteNav=document.querySelector('#gwSiteNav');
const siteHost=document.querySelector('#gwSiteMdtHost');
const siteSidebar=document.querySelector('#gwSiteSidebar');
const siteToggle=document.querySelector('#gwSiteToggle');
if(siteNav&&siteHost){
 const shell=document.querySelector('.shell');
 const topHeader=shell.querySelector('header');
 if(topHeader){const posStatus=document.querySelector('#status');const posSlot=document.querySelector('#gwPosStatusSlot');if(posStatus&&posSlot)posSlot.append(posStatus);const content=document.querySelector('.gw-site-content');content?.insertBefore(topHeader,shell);topHeader.classList.add('gw-global-header');const ribbon=shell.querySelector('.ribbon');if(ribbon){content?.insertBefore(ribbon,shell);ribbon.classList.add('gw-global-ribbon');}}
 const restricted=['overview','employees','sales','history','leaderboard','reports','analytics','adjustments','productanalytics','loyalty'];
 const businessPages=[['history','Sales History','sales_history'],['leaderboard','Employee Leaderboards','sales_earnings'],['reports','Financial Reports','sales_earnings'],['analytics','Sales Analytics','sales_earnings'],['adjustments','Refunds & Voids','sales_history'],['productanalytics','Product Analytics','sales_earnings'],['loyalty','Loyalty & Rewards','loyalty_view'],['announcements','Announcements','announcements'],['notes','Employee Notes','employee_notes']];
 const salesSubmenu=document.createElement('div');salesSubmenu.className='gw-site-submenu';salesSubmenu.hidden=true;
 for(const [page,label] of businessPages.filter(([page])=>['history','leaderboard','reports','analytics','adjustments','productanalytics','loyalty'].includes(page))){const b=document.createElement('button');b.type='button';b.dataset.sitePage=page;b.textContent=label;salesSubmenu.append(b);}
 siteNav.querySelector('[data-site-page="sales"]')?.after(salesSubmenu);

 const permissionsNav=document.createElement('button');permissionsNav.type='button';permissionsNav.dataset.sitePage='permissions';permissionsNav.innerHTML='<span class="gw-site-icon">⚿</span><span class="gw-site-label">Roles & Permissions</span><span class="gw-site-arrow">›</span>';
 // Roles & Permissions belongs inside the expandable Admin section.
 const featureForPage={overview:'dashboard',employees:'employees',time:'time_management',sales:'sales_earnings',history:'sales_history',leaderboard:'sales_earnings',reports:'sales_earnings',analytics:'sales_earnings',adjustments:'sales_history',productanalytics:'sales_earnings',loyalty:'loyalty_view',announcements:'announcements',notes:'employee_notes'};
 async function loadGrantedFeatures(){
  grantedFeatures=new Set();
  if(bossAllowed){roleFeatures.forEach(([feature])=>grantedFeatures.add(feature));return;}
  if(!token||!me)return;
  try{const rows=await call('gw_mdt_my_permissions',{p_token:token});for(const item of rows||[])if(item.allowed)grantedFeatures.add(item.feature);}catch(e){console.warn('Unable to load MDT role permissions',e);}
 }
async function showBackupCenter(){
 mdtContent.replaceChildren();
 const heading=make('div',undefined,'gw-mdt-head');heading.append(make('h2','Export & Backup Center'),make('p','Download available business records as CSV files. Exports reflect the permissions and records returned by the database.'));
 mdtContent.append(heading);
 const status=make('p','Choose an export.','gw-mdt-message');mdtContent.append(status);
 const options=[['Sales History','gw_mdt_sales_history',{p_from:null,p_to:null,p_employee:null},'sales-history'],['Employee Sales','gw_mdt_sales_report_for_role',{},'employee-sales'],['Audit History','gw_mdt_activity_search',{p_search:'',p_from:null,p_to:null},'audit-history']];
 const cards=make('div',undefined,'gw-feature-grid');mdtContent.append(cards);
 for(const [label,rpc,args,filename] of options){
  const card=make('article',undefined,'gw-feature-card'),title=make('h3',label),desc=make('p','Export records to a spreadsheet-compatible CSV file.'),button=make('button','Download CSV','primary');
  button.onclick=async()=>{button.disabled=true;status.textContent='Preparing '+label+'…';try{
   const rows=await call(rpc,{p_token:token||'',...args});
   if(!Array.isArray(rows)||!rows.length){status.textContent='No records available for '+label+'.';return;}
   const headers=[...new Set(rows.flatMap(row=>Object.keys(row)))];
   const esc=v=>'"'+String(v==null?'':typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';
   const csv=[headers,...rows.map(row=>headers.map(key=>row[key]))].map(line=>line.map(esc).join(',')).join('\\r\\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='green-wonderland-'+filename+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
   status.textContent='Exported '+rows.length+' records. Some queries may be limited by the database.';
  }catch(e){status.textContent='Export failed: '+e.message;}finally{button.disabled=false;}};
  card.append(title,desc,button);cards.append(card);
 }
}
 const extraPages=[['notifications','Notifications','announcements','✦'],['backups','Export & Backup Center','activity_history','⇩']];
 const extraNav=new Map();
 for(const [page,label,feature,glyph] of extraPages){
  const b=document.createElement('button');b.type='button';b.dataset.sitePage=page;b.className='gw-admin-subitem gw-admin-'+page;
  const symbol=document.createElement('span');symbol.className='gw-site-icon';symbol.textContent=glyph;
  const caption=document.createElement('span');caption.className='gw-site-label';caption.textContent=label;b.append(symbol,caption);
  b.onclick=()=>showSite(page);extraNav.set(page,b);
 }
 const securityLink=document.createElement('button');securityLink.type='button';securityLink.dataset.sitePage='security';securityLink.className='gw-admin-subitem gw-admin-security';securityLink.innerHTML='<span class="gw-site-icon" aria-hidden="true">⚿</span><span class="gw-site-label">Security Center</span>';securityLink.onclick=()=>showSite('security');
 const offersLink=document.createElement('button');offersLink.type='button';offersLink.dataset.sitePage='offers';offersLink.className='gw-admin-subitem gw-admin-offers';offersLink.innerHTML='<span class="gw-site-icon">✦</span><span class="gw-site-label">Bundles & Specials</span>';offersLink.onclick=()=>showSite('offers');
 const adminSubmenu=document.createElement('div');adminSubmenu.className='gw-site-submenu';adminSubmenu.hidden=true;
 const catalogLink=document.createElement('button');catalogLink.type='button';catalogLink.className='gw-admin-subitem gw-admin-catalog';catalogLink.innerHTML='<span class="gw-site-icon" aria-hidden="true">▦</span><span class="gw-site-label">Products, Images & Settings</span>';
 const brandingLink=document.createElement('button');brandingLink.type='button';brandingLink.className='gw-admin-subitem gw-admin-branding';brandingLink.innerHTML='<span class="gw-site-icon" aria-hidden="true">✦</span><span class="gw-site-label">Branding & Images</span>';
  const auditLink=document.createElement('button');auditLink.type='button';auditLink.dataset.sitePage='audit';auditLink.classList.add('gw-admin-subitem','gw-admin-audit');auditLink.innerHTML='<span class="gw-site-icon">▤</span><span class="gw-site-label">Full Audit Log</span>';
 permissionsNav.classList.add('gw-admin-subitem','gw-admin-permissions');adminSubmenu.append(catalogLink,brandingLink,auditLink,permissionsNav,securityLink,offersLink,extraNav.get('backups'));navButtonAdminPlaceholder();
 function navButtonAdminPlaceholder(){siteNav.querySelector('[data-site-page="admin"]')?.after(adminSubmenu);}
 catalogLink.onclick=()=>document.querySelector('#adminBtn')?.click();
 brandingLink.onclick=()=>window.gwOpenBrandingAdmin?.();
  auditLink.onclick=()=>showSite('audit');
 let currentPage='pos';
 const navButton=p=>siteNav.querySelector('[data-site-page="'+p+'"]');
 async function refreshNavigation(){
  await checkBoss();
  await loadGrantedFeatures();
  for(const p of restricted)navButton(p).hidden=!canFeature(featureForPage[p])&&!(p==='loyalty'&&canFeature('loyalty_adjust'));
  for(const p of ['history','leaderboard','reports','adjustments','productanalytics','loyalty'])navButton(p).hidden=!canFeature(featureForPage[p])&&!(p==='loyalty'&&canFeature('loyalty_adjust'));
  navButton('time').hidden=!bossAllowed&&!grantedFeatures.has('time_management');
  permissionsNav.hidden=!bossAllowed;
  securityLink.hidden=!bossAllowed;
  offersLink.hidden=!canFeature('offers_manage');
   auditLink.hidden=!canFeature('activity_history');

   extraNav.get('backups').hidden=!bossAllowed;
  navButton('admin').hidden=!(bossAllowed||grantedFeatures.has('admin_catalog')||grantedFeatures.has('admin_branding')||grantedFeatures.has('activity_history')||grantedFeatures.has('announcements')||grantedFeatures.has('offers_manage'));
  catalogLink.hidden=!bossAllowed;
  brandingLink.hidden=!bossAllowed;
  if(!bossAllowed)adminSubmenu.hidden=true;

  // Everyone can reach the time clock; staff adjustments remain Boss-only.
  const adminBtn=document.querySelector('#adminBtn');
  if(adminBtn){adminBtn.textContent=bossAllowed?'⚙ Admin Account':'Admin Login';adminBtn.hidden=false;adminBtn.title=bossAllowed?'Manage your administrator account and product settings':'Sign in with your administrator email and password';}
  if(currentPage!=='pos'&&currentPage!=='permissions'&&currentPage!=='audit'&&currentPage!=='security'&&currentPage!=='backups'&&currentPage!=='offers'&&!grantedFeatures.has(featureForPage[currentPage])&&!bossAllowed)await showSite('pos');
   if(currentPage==='audit'&&!canFeature('activity_history'))await showSite('pos');
  if(currentPage==='offers'&&!canFeature('offers_manage'))await showSite('pos');
  if((currentPage==='permissions'||currentPage==='security'||currentPage==='backups')&&!bossAllowed)await showSite('pos');
 }
 async function showSite(page){
  if(page==='permissions'&&!bossAllowed)return;
   if(page==='audit'&&!canFeature('activity_history'))return;
  if(page==='backups'&&!bossAllowed)return;
  if(page==='security'&&!bossAllowed)return;
  if(page==='offers'&&!canFeature('offers_manage'))return;
  if(page==='notifications'&&!canFeature('announcements')&&!canFeature('announcements_manage'))return;
  if(restricted.includes(page)&&!canFeature(featureForPage[page])&&!(page==='loyalty'&&canFeature('loyalty_adjust'))&&!(page==='announcements'&&canFeature('announcements_manage'))&&!(page==='notes'&&canFeature('employee_notes_manage')&&canFeature('employees')))return;
  if(page==='admin'){siteSidebar.classList.remove('collapsed');siteToggle?.setAttribute('aria-expanded','true');siteToggle?.setAttribute('aria-label','Collapse navigation');adminSubmenu.hidden=!adminSubmenu.hidden;return;}
  siteSidebar.classList.remove('collapsed');siteToggle?.setAttribute('aria-expanded','true');siteToggle?.setAttribute('aria-label','Collapse navigation');
  if(!['permissions','audit','security','backups','offers'].includes(page))adminSubmenu.hidden=true;
  salesSubmenu.hidden=!(['sales','history','leaderboard','reports','analytics','adjustments','productanalytics'].includes(page));
  currentPage=page;
  siteNav.querySelectorAll('[data-site-page]').forEach(b=>b.classList.toggle('active',b.dataset.sitePage===page));
  const pos=page==='pos';shell.hidden=!pos;siteHost.hidden=pos;
  if(pos)return;
  if(page==='permissions'){adminSubmenu.hidden=false;await showRolePermissions();return;}
   if(page==='audit'){adminSubmenu.hidden=false;mdtMessage.textContent='';await showActivitySearch(mdtContent,{call,token:()=>token||'',make});
   const appendLog=async(title,rpc,transform)=>{
    const heading=make('h3',title),list=make('div',undefined,'gw-audit-list');mdtContent.append(heading,list);
    try{const rows=await call(rpc,{p_token:token||''});
     for(const a of rows.slice(0,100)){
      const record=transform(a),card=make('article',undefined,'gw-audit-card gw-audit-updated');
      const body=make('div',undefined,'gw-audit-card-body');
      body.append(make('strong',record.title));
      const people=make('div',undefined,'gw-audit-people');
      const actor=make('div',undefined,'gw-audit-person');actor.append(make('small','PERFORMED BY'),make('strong',record.actor));
      const subject=make('div',undefined,'gw-audit-person');subject.append(make('small','AFFECTED RECORD'),make('strong',record.subject));
      people.append(actor,subject);
      body.append(people,make('p',record.details,'gw-audit-details'),make('small',new Date(record.date).toLocaleString()));
      card.append(make('span','▤','gw-audit-icon'),body);list.append(card);
     }
     if(!rows.length)list.append(make('p','No additional events recorded.'));
    }catch(err){list.append(make('p','Additional events unavailable: '+err.message));}
   };
   if(canFeature('sales_history'))await appendLog('Financial Adjustment Activity','gw_mdt_sale_adjustments_list',a=>({title:a.adjustment_type.toUpperCase()+' · '+cash(a.amount),actor:a.performed_by||'Unknown',subject:'Sale '+a.sale_id,details:a.reason,date:a.created_at}));
   if(bossAllowed)await appendLog('Security Activity','gw_security_events_list',a=>({title:a.event_type.replaceAll('_',' ').toUpperCase(),actor:a.actor_name||'Unknown',subject:a.target_name||'Unknown',details:a.details,date:a.created_at}));
   return;}
  if(page==='backups'){adminSubmenu.hidden=false;await showBackupCenter();return;}
  if(page==='security'){adminSubmenu.hidden=false;mdtMessage.textContent='';await showSecurityCenter(mdtContent,{call,token:()=>token||'',make,cash});return;}
  if(page==='offers'){adminSubmenu.hidden=false;mdtMessage.textContent='';await showOffersManager(mdtContent,{call,token:()=>token||'',make,cash});return;}
  if(page==='productanalytics'){mdtMessage.textContent='';await showProductAnalytics(mdtContent,{call,token:()=>token||'',make,cash});return;}
  if(page==='loyalty'){mdtMessage.textContent='';await renderLoyaltyManagement(mdtContent,{call,token:()=>token||'',canFeature,cash,make});return;}
  if(page==='adjustments'){await showSaleAdjustments(mdtContent,{call,token:()=>token||'',canFeature,cash,make});return;}
  if(page==='analytics'){await showAnalytics(mdtContent,{call,token:()=>token||'',cash,make});return;}
  if(businessPages.some(([name])=>name===page)){shell.hidden=true;siteHost.hidden=false;await renderBusinessPage(page,{host:mdtContent,call,token:()=>token||'',canFeature,cash,make});return;}
  if(page==='admin-legacy'){
   mdtContent.replaceChildren(make('h2','Store Administration'),make('p','Manage the catalog, delivery zones, settings, branding and images.'));
   const controls=make('div',undefined,'gw-mdt-actions');
   const catalog=make('button','Products, Delivery Zones & Settings','primary');catalog.onclick=()=>document.querySelector('#adminBtn')?.click();
   const branding=make('button','Branding & Images','outline');branding.onclick=()=>{const settings=Array.from(document.querySelectorAll('header .actions button')).find(b=>b.textContent.includes('Settings'));if(settings)settings.click();};
   controls.append(catalog,branding);mdtContent.append(controls);mdtMessage.textContent='';return;
  }
  mdtMessage.textContent='Loading store information…';
  try{
   if(page!=='sales')await loadStaff(page);
   if(page==='overview'&&canFeature('sales_earnings')){try{await loadSales();}catch(e){salesRows=[];console.warn('Sales summary unavailable',e);}}
   await switchPage(page);
   if(page!=='sales')mdtMessage.textContent='';
  }catch(err){mdtContent.replaceChildren();mdtMessage.textContent=err.message;}
 }
 siteHost.append(mdt);mdt.setAttribute('open','');
 mdt.querySelector('.gw-mdt-sidebar').hidden=true;
 mdt.querySelector('#gwMdtClose').hidden=true;
 mdt.querySelector('.dialogHead').hidden=true;
 mdtButton.hidden=true;mdtButton.style.display='none';
 button.hidden=true;button.style.display='none';
 siteNav.querySelectorAll('[data-site-page]').forEach(b=>b.addEventListener('click',()=>showSite(b.dataset.sitePage)));
 siteToggle?.addEventListener('click',()=>{const collapsed=siteSidebar.classList.toggle('collapsed');if(collapsed){adminSubmenu.hidden=true;salesSubmenu.hidden=true;}siteToggle.setAttribute('aria-expanded',String(!collapsed));siteToggle.setAttribute('aria-label',collapsed?'Expand navigation':'Collapse navigation');});
 document.querySelector('#logout')?.addEventListener('click',()=>{bossAllowed=false;refreshNavigation();});
 db.auth.onAuthStateChange(()=>setTimeout(refreshNavigation,100));
 document.querySelector('#login')?.addEventListener('click',()=>setTimeout(refreshNavigation,800));
 document.querySelector('#adminBtn')?.addEventListener('click',()=>setTimeout(refreshNavigation,500));
 document.querySelector('#gwEmpClose')?.addEventListener('click',()=>{updateClockStatus();refreshNavigation();if(currentPage==='time')showSite('time');});
 refreshNavigation();updateClockStatus();refreshWeeklyHours();
 window.gwRefreshRoleNavigation=refreshNavigation;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token)refreshWeeklyHours();});
 setInterval(()=>{if(token&&me?.clocked_in)refreshWeeklyHours();},60000);
}
