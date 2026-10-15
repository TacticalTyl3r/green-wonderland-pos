import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY), key='gw-employee-token';
let token=sessionStorage.getItem(key)||'',me=null,employees=[];
const dlg=document.createElement('dialog');dlg.id='gwEmployeeDialog';
dlg.innerHTML=`<div class="dialogHead"><h2>EMPLOYEE TIME CLOCK</h2><button id="gwEmpClose" class="outline">✕</button></div><div id="gwEmpView"></div><p id="gwEmpMsg" role="status"></p>`;
document.body.append(dlg);
const view=dlg.querySelector('#gwEmpView'),msg=s=>dlg.querySelector('#gwEmpMsg').textContent=s;
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
 if(token){const rows=await call('gw_pin_me',{p_token:token});me=rows?.[0]||null;if(!me){token='';sessionStorage.removeItem(key);}}
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
 const logout=document.createElement('button');logout.textContent='Sign out';logout.onclick=async()=>{try{await call('gw_pin_logout',{p_token:token});}finally{token='';me=null;sessionStorage.removeItem(key);await refresh();}};
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
const mdt=document.createElement('dialog');mdt.id='gwMdt';mdt.innerHTML='<div class="dialogHead"><div><small>GREEN WONDERLAND / MANAGEMENT</small><h2>STORE MDT</h2></div><button class="outline" id="gwMdtClose">✕</button></div><div class="gw-mdt-tabs"><button data-page="overview" class="active">Overview</button><button data-page="employees">Employees</button><button data-page="time">Time Management</button></div><div id="gwMdtContent"></div><p id="gwMdtMessage" role="status"></p>';document.body.append(mdt);
mdt.querySelector('#gwMdtClose').onclick=()=>mdt.close();
const mdtContent=mdt.querySelector('#gwMdtContent'),mdtMessage=mdt.querySelector('#gwMdtMessage');
let mdtPage='overview',staffRows=[],bossAllowed=false;
const formatHours=n=>(Number(n||0)/60).toFixed(2);
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
async function checkBoss(){try{const {data:{session}}=await db.auth.getSession();if(!session){bossAllowed=false;}else{const {data,error}=await db.rpc('gw_is_boss');bossAllowed=!error&&data===true;}mdtButton.hidden=false;}catch(e){bossAllowed=false;mdtButton.hidden=false;}return bossAllowed;}
async function loadStaff(){staffRows=await call('gw_staff_report');return staffRows;}
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
 const active=staffRows.filter(e=>e.active!==false),onDuty=active.filter(e=>e.clocked_in).length;
 if(mdtPage==='overview'){
  const cards=make('div',undefined,'gw-mdt-stats');
  for(const [label,value] of [['Active Employees',active.length],['Currently Clocked In',onDuty],['Recorded Staff Hours',formatHours(staffRows.reduce((sum,e)=>sum+Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0),0))]]){const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',String(value)));cards.append(card);}mdtContent.append(cards);
  mdtContent.append(make('h3','Store Management'),make('p','Manage employee records and shift adjustments from one place. Sales reports and inventory management will be added in future updates.'));
  const jump=make('button','Open Employee Roster','primary');jump.onclick=()=>switchPage('employees');mdtContent.append(jump);
 }else{
  const head=make('div',undefined,'gw-mdt-head');head.append(make('h3',mdtPage==='employees'?'Employee Roster':'Employee Hours'));
  if(mdtPage==='employees'){const add=make('button','+ Add Employee','primary');add.onclick=()=>employeeForm();head.append(add);}mdtContent.append(head);
  const table=make('div',undefined,'gw-mdt-roster');
  for(const e of staffRows){const row=make('div',undefined,'gw-mdt-employee');const info=make('div');info.append(make('strong',e.name),make('p',e.role+' · '+(e.active===false?'Inactive':e.clocked_in?'On duty':'Off duty')+' · '+formatHours(Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0))+' hours'));const actions=make('div',undefined,'gw-mdt-actions');if(mdtPage==='employees'){const edit=make('button','Edit / PIN','outline');edit.onclick=()=>employeeForm(e);actions.append(edit);}const adjust=make('button','Adjust Time','outline');adjust.onclick=()=>adjustTime(e);actions.append(adjust);row.append(info,actions);table.append(row);}if(!staffRows.length)table.append(make('p','No employees found. Add your first employee to get started.'));mdtContent.append(table);
 }
}
function switchPage(page){mdtPage=page;mdt.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));renderMdt();}
mdt.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>switchPage(b.dataset.page));
mdtButton.onclick=async()=>{mdt.showModal();mdtMessage.textContent='Checking management access…';if(!await checkBoss()){mdtContent.replaceChildren(make('h3','Management sign-in required'),make('p','Sign in using the Admin button with your Boss account, then reopen Store MDT. If already signed in, sign out and sign back in to refresh your session.'));mdtMessage.textContent='Your current website session does not have Boss access.';return;}mdtMessage.textContent='Loading employees…';try{await loadStaff();mdtMessage.textContent='';switchPage('overview');}catch(e){mdtMessage.textContent=e.message;}};
document.querySelector('#adminBtn')?.addEventListener('click',()=>setTimeout(checkBoss,400));
document.querySelector('#login')?.addEventListener('click',()=>setTimeout(checkBoss,800));
document.querySelector('#logout')?.addEventListener('click',()=>{bossAllowed=false;mdtButton.hidden=false;mdt.close();});
db.auth.onAuthStateChange(()=>setTimeout(checkBoss,0));
checkBoss();
roster().then(refresh).catch(e=>{msg('Employee service not configured yet: '+e.message);holder.hidden=true;});
