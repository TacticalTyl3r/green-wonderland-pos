import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY), key='gw-employee-token';
let token=sessionStorage.getItem(key)||'',me=null,employees=[];
const dlg=document.createElement('dialog');dlg.id='gwEmployeeDialog';
dlg.innerHTML=`<div class="dialogHead"><h2>EMPLOYEE TIME CLOCK</h2><button id="gwEmpClose" class="outline">✕</button></div><div id="gwEmpView"></div><p id="gwEmpMsg" role="status"></p>`;
document.body.append(dlg);
const view=dlg.querySelector('#gwEmpView'),msg=s=>dlg.querySelector('#gwEmpMsg').textContent=s;
const clockStatus=document.querySelector('#gwClockStatus');
function updateClockStatus(){if(clockStatus){clockStatus.textContent=me?(me.clocked_in?'● Clocked In · ':'○ Clocked Out · ')+me.employee_name:'○ Not Clocked In';clockStatus.classList.toggle('on-duty',!!me?.clocked_in);}}
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
 updateClockStatus();
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
 updateAttribution();
 }catch(e){msg(e.message);}
}
window.gwRecordSale=async sale=>{
 if(!employees.length)await roster();
 if(token){const rows=await call('gw_pin_me',{p_token:token});me=rows?.[0]||null;if(!me){token='';sessionStorage.removeItem(key);}}
 const selected=me?.employee_id||select.value;
 if(!selected)throw Error('Select the employee responsible for this sale.');
 return await call('gw_record_sale',{p_token:token||'',p_employee:selected,p_total:sale.total,p_count:sale.count,p_fulfillment:sale.fulfillment});
};
// Store MDT: uses existing Boss-authorized RPCs. No schema change required.
const mdtButton=document.createElement('button');mdtButton.className='outline';mdtButton.textContent='▦ Store MDT';mdtButton.hidden=false;document.querySelector('header .actions')?.append(mdtButton);
const mdt=document.createElement('dialog');mdt.id='gwMdt';mdt.innerHTML='<div class="dialogHead"><div><small>GREEN WONDERLAND / MANAGEMENT</small><h2>STORE MDT</h2></div><button class="outline" id="gwMdtClose">✕</button></div><div class="gw-mdt-layout"><nav class="gw-mdt-sidebar" aria-label="Store MDT navigation"><button type="button" id="gwMdtToggle" class="gw-mdt-toggle" aria-label="Collapse sidebar" aria-expanded="true">☰ <span>Navigation</span></button><div class="gw-mdt-tabs"><button data-page="overview" class="active" title="Overview"><span class="gw-mdt-icon">▦</span><span class="gw-mdt-label">Dashboard</span><span class="gw-mdt-chevron">›</span></button><button data-page="employees" title="Employees"><span class="gw-mdt-icon">♙</span><span class="gw-mdt-label">Employees</span><span class="gw-mdt-chevron">›</span></button><button data-page="time" title="Time Management"><span class="gw-mdt-icon">◷</span><span class="gw-mdt-label">Time Management</span><span class="gw-mdt-chevron">›</span></button><button data-page="sales" title="Sales & Earnings"><span class="gw-mdt-icon">$</span><span class="gw-mdt-label">Sales & Earnings</span><span class="gw-mdt-chevron">›</span></button></div></nav><section class="gw-mdt-main"><div id="gwMdtContent"></div><p id="gwMdtMessage" role="status"></p></section></div>';document.body.append(mdt);
mdt.querySelector('#gwMdtClose').onclick=()=>mdt.close();
const sidebarToggle=mdt.querySelector('#gwMdtToggle');sidebarToggle.onclick=()=>{const collapsed=mdt.classList.toggle('gw-mdt-collapsed');sidebarToggle.setAttribute('aria-expanded',String(!collapsed));sidebarToggle.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');};
const mdtContent=mdt.querySelector('#gwMdtContent'),mdtMessage=mdt.querySelector('#gwMdtMessage');
let mdtPage='overview',staffRows=[],salesRows=[],bossAllowed=false;
const formatHours=n=>(Number(n||0)/60).toFixed(2);
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
async function checkBoss(){try{const {data:{session}}=await db.auth.getSession();if(!session){bossAllowed=false;}else{const {data,error}=await db.rpc('gw_is_boss');bossAllowed=!error&&data===true;}mdtButton.hidden=false;}catch(e){bossAllowed=false;mdtButton.hidden=false;}return bossAllowed;}
async function loadStaff(){staffRows=await call('gw_staff_report');return staffRows;}
async function loadSales(){salesRows=await call('gw_mdt_sales_report');}
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
}
function employeeForm(e){
 const form=make('form',undefined,'gw-mdt-form');
 const title=make('h3',e?'Edit Employee':'Add Employee');form.append(title);
 const field=(label,input)=>{const l=make('label',label);l.append(input);form.append(l);return input;};
 const name=field('Employee name',document.createElement('input'));name.required=true;name.maxLength=100;name.value=e?.name||'';
 const role=document.createElement('select');for(const r of ['Boss','Manager','Senior Salesman','Salesman'])role.add(new Option(r,r));role.value=e?.role||'Salesman';field('Position',role);
 const pin=field(e?'New PIN (leave blank to keep existing)':'Employee PIN (4–12 digits)',document.createElement('input'));pin.type='password';pin.inputMode='numeric';pin.minLength=4;pin.maxLength=12;pin.pattern='[0-9]{4,12}';pin.required=!e;pin.autocomplete='new-password';
 const active=document.createElement('input');active.type='checkbox';active.checked=e?e.active!==false:true;field('Active employee',active);
 const actions=make('div',undefined,'gw-mdt-actions');const save=make('button','Save Employee','primary');save.type='submit';const cancel=make('button','Cancel','outline');cancel.type='button';cancel.onclick=()=>renderMdt();actions.append(save,cancel);form.append(actions);
 form.onsubmit=async ev=>{ev.preventDefault();save.disabled=true;mdtMessage.textContent='Saving employee…';try{await call('gw_manage_employee',{p_id:e?.id||null,p_name:name.value.trim(),p_role:role.value,p_pin:pin.value||null,p_active:active.checked});await roster();await loadStaff();mdtMessage.textContent='Employee saved.';renderMdt();}catch(err){mdtMessage.textContent=err.message;}finally{save.disabled=false;}};
 mdtContent.replaceChildren(form);name.focus();
}
async function adjustTime(e){
 const form=make('form',undefined,'gw-mdt-form');form.append(make('h3','Adjust Time — '+e.name));
 const mins=document.createElement('input');mins.type='number';mins.step='1';mins.required=true;mins.placeholder='e.g. 30 or -15';
 const reason=document.createElement('input');reason.required=true;reason.minLength=5;reason.maxLength=500;reason.placeholder='Reason for adjustment';
 for(const [name,input] of [['Minutes to add or subtract',mins],['Reason (recorded in audit history)',reason]]){const label=make('label',name);label.append(input);form.append(label);}
 const actions=make('div',undefined,'gw-mdt-actions'),save=make('button','Save Adjustment','primary'),cancel=make('button','Cancel','outline');save.type='submit';cancel.type='button';cancel.onclick=()=>renderMdt();actions.append(save,cancel);form.append(actions);
 form.onsubmit=async ev=>{ev.preventDefault();const value=Number(mins.value);if(!Number.isSafeInteger(value)||value===0){mdtMessage.textContent='Enter a nonzero whole number of minutes.';return;}save.disabled=true;try{await call('gw_adjust_time',{p_employee:e.id,p_minutes:value,p_reason:reason.value.trim()});await loadStaff();mdtMessage.textContent='Time adjustment saved with reason.';renderMdt();}catch(err){mdtMessage.textContent=err.message;}finally{save.disabled=false;}};
 mdtContent.replaceChildren(form);
}
function renderMdt(){
 mdtContent.replaceChildren();
 if(mdtPage==='time'){const clockCard=make('div',undefined,'gw-mdt-stat');clockCard.append(make('h3','Employee Time Clock'),make('p',me?(me.employee_name+' · '+(me.clocked_in?'Clocked In':'Clocked Out')):'Sign in with your employee PIN to clock in or out.'));const openClock=make('button','Open Time Clock','primary');openClock.onclick=()=>button.click();clockCard.append(openClock);mdtContent.append(clockCard);}
 const active=staffRows.filter(e=>e.active!==false),onDuty=active.filter(e=>e.clocked_in).length;
 if(mdtPage==='sales'){renderSales();}else if(mdtPage==='overview'){
  const cards=make('div',undefined,'gw-mdt-stats');
  for(const [label,value] of [['Active Employees',active.length],['Currently Clocked In',onDuty],['Recorded Staff Hours',formatHours(staffRows.reduce((sum,e)=>sum+Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0),0))]]){const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',String(value)));cards.append(card);}mdtContent.append(cards);
  mdtContent.append(make('h3','Store Management'),make('p','Manage employee records and shift adjustments from one place. Sales & Earnings is available in the main sidebar. Inventory management is planned for a future update.'));
  const jump=make('button','Open Employee Roster','primary');jump.onclick=()=>switchPage('employees');mdtContent.append(jump);
 }else{
  const head=make('div',undefined,'gw-mdt-head');head.append(make('h3',mdtPage==='employees'?'Employee Roster':'Employee Hours'));
  if(mdtPage==='employees'){const add=make('button','+ Add Employee','primary');add.onclick=()=>employeeForm();head.append(add);}mdtContent.append(head);
  const table=make('div',undefined,'gw-mdt-roster');
  for(const e of staffRows){const row=make('div',undefined,'gw-mdt-employee');const info=make('div');info.append(make('strong',e.name),make('p',e.role+' · '+(e.active===false?'Inactive':e.clocked_in?'On duty':'Off duty')+' · '+formatHours(Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0))+' hours'));const actions=make('div',undefined,'gw-mdt-actions');if(mdtPage==='employees'){const edit=make('button','Edit / PIN','outline');edit.onclick=()=>employeeForm(e);actions.append(edit);}const adjust=make('button','Adjust Time','outline');adjust.onclick=()=>adjustTime(e);actions.append(adjust);row.append(info,actions);table.append(row);}if(!staffRows.length)table.append(make('p','No employees found. Add your first employee to get started.'));mdtContent.append(table);
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


/* Full-page Store MDT navigation and permission-aware menu */
const siteNav=document.querySelector('#gwSiteNav');
const siteHost=document.querySelector('#gwSiteMdtHost');
const siteSidebar=document.querySelector('#gwSiteSidebar');
const siteToggle=document.querySelector('#gwSiteToggle');
if(siteNav&&siteHost){
 const shell=document.querySelector('.shell');
 const topHeader=shell.querySelector('header');
 if(topHeader){const content=document.querySelector('.gw-site-content');content?.insertBefore(topHeader,shell);topHeader.classList.add('gw-global-header');const ribbon=shell.querySelector('.ribbon');if(ribbon){content?.insertBefore(ribbon,shell);ribbon.classList.add('gw-global-ribbon');}}
 const restricted=['overview','employees','sales'];
 let currentPage='pos';
 const navButton=p=>siteNav.querySelector('[data-site-page="'+p+'"]');
 async function refreshNavigation(){
  await checkBoss();
  for(const p of restricted)navButton(p).hidden=!bossAllowed;
  navButton('admin').hidden=!bossAllowed;
  // Everyone can reach the time clock; staff adjustments remain Boss-only.
  const adminBtn=document.querySelector('#adminBtn');
  if(adminBtn)adminBtn.textContent=bossAllowed?'⚙ Admin':'Sign in';
  if(!bossAllowed&&restricted.concat('admin').includes(currentPage))await showSite('pos');
 }
 async function showSite(page){
  if(page==='admin'&&!bossAllowed)return;
  if(restricted.includes(page)&&!bossAllowed)return;
  currentPage=page;
  siteNav.querySelectorAll('[data-site-page]').forEach(b=>b.classList.toggle('active',b.dataset.sitePage===page));
  const pos=page==='pos';shell.hidden=!pos;siteHost.hidden=pos;
  if(pos)return;
  if(page==='admin'){
   mdtContent.replaceChildren(make('h2','Store Administration'),make('p','Manage the catalog, delivery zones, settings, branding and images.'));
   const controls=make('div',undefined,'gw-mdt-actions');
   const catalog=make('button','Products, Delivery Zones & Settings','primary');catalog.onclick=()=>document.querySelector('#adminBtn')?.click();
   const branding=make('button','Branding & Images','outline');branding.onclick=()=>{const settings=Array.from(document.querySelectorAll('header .actions button')).find(b=>b.textContent.includes('Settings'));if(settings)settings.click();};
   controls.append(catalog,branding);mdtContent.append(controls);mdtMessage.textContent='';return;
  }
  mdtMessage.textContent='Loading store information…';
  try{
   if(page==='time'&&!bossAllowed){mdtPage='time';staffRows=[];mdtContent.replaceChildren();const card=make('div',undefined,'gw-mdt-stat');card.append(make('h3','Employee Time Clock'),make('p',me?(me.employee_name+' · '+(me.clocked_in?'Clocked In':'Clocked Out')):'Sign in with your employee PIN to clock in or out.'));const launch=make('button','Open Time Clock','primary');launch.onclick=()=>button.click();card.append(launch);mdtContent.append(card);}
   else{await loadStaff();await switchPage(page);}
   if(page!=='sales')mdtMessage.textContent='';
  }catch(err){mdtContent.replaceChildren();mdtMessage.textContent=err.message;}
 }
 siteHost.append(mdt);mdt.setAttribute('open','');
 mdt.querySelector('.gw-mdt-sidebar').hidden=true;
 mdt.querySelector('#gwMdtClose').hidden=true;
 mdtButton.hidden=true;mdtButton.style.display='none';
 button.hidden=true;button.style.display='none';
 siteNav.querySelectorAll('[data-site-page]').forEach(b=>b.addEventListener('click',()=>showSite(b.dataset.sitePage)));
 siteToggle?.addEventListener('click',()=>{const collapsed=siteSidebar.classList.toggle('collapsed');siteToggle.setAttribute('aria-expanded',String(!collapsed));siteToggle.setAttribute('aria-label',collapsed?'Expand navigation':'Collapse navigation');});
 document.querySelector('#logout')?.addEventListener('click',()=>{bossAllowed=false;refreshNavigation();});
 db.auth.onAuthStateChange(()=>setTimeout(refreshNavigation,100));
 document.querySelector('#login')?.addEventListener('click',()=>setTimeout(refreshNavigation,800));
 document.querySelector('#adminBtn')?.addEventListener('click',()=>setTimeout(refreshNavigation,500));
 document.querySelector('#gwEmpClose')?.addEventListener('click',()=>{updateClockStatus();if(currentPage==='time')showSite('time');});
 refreshNavigation();updateClockStatus();
}
