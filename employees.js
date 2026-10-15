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
async function setupBoss(){
 const {data}=await db.auth.getSession();if(!data.session)return;
 const {data:isBoss}=await db.rpc('gw_is_boss');if(isBoss!==true)return;
 const section=document.createElement('section');section.className='gw-staff-admin';section.innerHTML='<h3>Employee management & time adjustments</h3><p>Create PIN accounts, manage positions, and audit time changes.</p>';
 const target=document.querySelector('#adminPanel');if(!target)return;target.append(section);
 const list=document.createElement('div');section.append(list);
 async function render(){
 const rows=await call('gw_staff_report');list.replaceChildren();
 for(const e of rows){
 const row=document.createElement('div');row.className='gw-staff-row';
 const title=document.createElement('strong');title.textContent=`${e.name} — ${e.role} | ${((Number(e.worked_minutes)+Number(e.adjusted_minutes))/60).toFixed(2)} hours ${e.clocked_in?'(on shift)':''}`;
 const edit=document.createElement('button');edit.textContent='Edit / Reset PIN';
 edit.onclick=()=>editor(e);
 const adjust=document.createElement('button');adjust.textContent='Adjust time';
 adjust.onclick=async()=>{const minutes=prompt('Minutes to add or remove (negative to subtract):');if(minutes===null)return;const reason=prompt('Reason (required, minimum 5 characters):');if(reason===null)return;try{await call('gw_adjust_time',{p_employee:e.id,p_minutes:Number(minutes),p_reason:reason});await render();}catch(err){alert(err.message);}};
 row.append(title,edit,adjust);list.append(row);
 }
 }
 async function editor(e=null){
 const name=prompt('Employee name',e?.name||'');if(name===null)return;
 const role=prompt('Role: Boss, Manager, Senior Salesman, Salesman',e?.role||'Salesman');if(role===null)return;
 const pin=prompt(e?'New PIN (leave empty to keep current PIN)':'PIN (4-12 digits)');if(pin===null)return;
 const active=e?confirm('Keep this employee active? OK = Active; Cancel = Inactive'):true;
 try{await call('gw_manage_employee',{p_id:e?.id||null,p_name:name,p_role:role,p_pin:pin||null,p_active:active});await roster();await render();}catch(err){alert(err.message);}
 }
 const add=document.createElement('button');add.textContent='+ Add employee';add.onclick=()=>editor();section.append(add);await render();
}
document.querySelector('#adminBtn')?.addEventListener('click',()=>setTimeout(()=>setupBoss().catch(console.error),300));
document.querySelector('#login')?.addEventListener('click',()=>setTimeout(()=>setupBoss().catch(console.error),1000));
roster().then(refresh).catch(e=>{msg('Employee service not configured yet: '+e.message);holder.hidden=true;});
