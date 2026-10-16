// Green Wonderland Phase 3 tools: theme-aware, permission-protected admin features.
export async function showSecurityCenter(host,{call,token,make,cash}){
 host.replaceChildren();
 const heading=make('div',undefined,'gw-mdt-head');
 heading.append(make('h2','Employee Security Center'),make('p','Manage active PIN sessions and review sign-in security. Only employees signed in with a Boss PIN can use these controls.'));
 const status=make('p','Loading security details…'),grid=make('div',undefined,'gw-feature-grid'),events=make('div',undefined,'gw-feature-grid');
 host.append(heading,status,grid,make('h3','Recent Security Activity'),events);
 const rpc=(name,args={})=>call(name,{p_token:token(),...args});
 const render=async()=>{
  grid.replaceChildren();events.replaceChildren();
  if(!token()){status.textContent='Sign in with your Boss employee PIN first.';return;}
  try{
   const rows=await rpc('gw_security_overview');
   const groups=new Map();
   for(const r of rows){if(!groups.has(r.employee_id))groups.set(r.employee_id,[]);groups.get(r.employee_id).push(r);}
   status.textContent=groups.size+' employee accounts · Session revocations take effect on the next authenticated request.';
   for(const [employeeId,items] of groups){
    const first=items[0],sessions=items.filter(s=>s.session_id);
    const card=make('article',undefined,'gw-feature-card');
    card.append(make('strong',first.employee_name+' · '+first.employee_role),
      make('p',sessions.length+' active PIN session'+(sessions.length===1?'':'s')),
      make('small','Failed PIN attempts: '+(first.failed_attempts||0)+(first.locked_until?' · Lockout until '+new Date(first.locked_until).toLocaleString():'')));
    const actions=make('div',undefined,'gw-mdt-actions');
    if(sessions.length){
     const revokeAll=make('button','Revoke All Sessions','outline');
     revokeAll.onclick=async()=>{if(!confirm('Sign out all sessions for '+first.employee_name+'?'))return;revokeAll.disabled=true;
      try{await rpc('gw_security_revoke_employee',{p_employee:employeeId});await render();}
      catch(e){status.textContent='Unable to revoke: '+e.message;revokeAll.disabled=false;}};
     actions.append(revokeAll);
    }
    if(Number(first.failed_attempts)>0||first.locked_until){
     const reset=make('button','Clear PIN Lockout','outline');
     reset.onclick=async()=>{if(!confirm('Clear failed PIN attempts for '+first.employee_name+'?'))return;reset.disabled=true;
      try{await rpc('gw_security_reset_pin_lock',{p_employee:employeeId});await render();}
      catch(e){status.textContent=e.message;reset.disabled=false;}};
     actions.append(reset);
    }
    card.append(actions);
    for(const s of sessions){
     const row=make('div',undefined,'gw-security-session');
     row.append(make('span','Signed in '+new Date(s.session_created_at).toLocaleString()+' · Expires '+new Date(s.session_expires_at).toLocaleString()));
     const revoke=make('button','Revoke','outline');
     revoke.onclick=async()=>{if(!confirm('Revoke this session for '+first.employee_name+'?'))return;revoke.disabled=true;
      try{await rpc('gw_security_revoke_session',{p_session:s.session_id});await render();}
      catch(e){status.textContent=e.message;revoke.disabled=false;}};
     row.append(revoke);card.append(row);
    }
    grid.append(card);
   }
   const log=await rpc('gw_security_events_list');
   for(const e of log){
    const card=make('article',undefined,'gw-feature-card');
    card.append(make('strong',e.event_type.replaceAll('_',' ').toUpperCase()),
      make('p',e.details),make('small','Performed by '+(e.actor_name||'Unknown')+' · Affected '+(e.target_name||'Unknown')+' · '+new Date(e.created_at).toLocaleString()));
    events.append(card);
   }
   if(!log.length)events.append(make('p','No recorded security actions yet.'));
  }catch(e){status.textContent='Security Center requires the Phase 3 SQL migration and a Boss PIN session. '+e.message;}
 };
 await render();
}
export function renderEmployeeAchievements(host,{staff,sales,make,cash}){
 host.replaceChildren();
 const totals=new Map(sales.map(s=>[String(s.employee_id),s]));
 const badges=[
  {name:'First 10 Orders',icon:'✦',test:(e,s)=>Number(s?.total_orders||0)>=10},
  {name:'100 Orders',icon:'◆',test:(e,s)=>Number(s?.total_orders||0)>=100},
  {name:'Sales Star',icon:'★',test:(e,s)=>Number(s?.lifetime_sales||0)>=100000},
  {name:'Dedicated Team Member',icon:'◷',test:e=>Number(e.worked_minutes||0)+Number(e.adjusted_minutes||0)>=3600}
 ];
 const rows=staff.filter(e=>e.active!==false);
 const grid=make('div',undefined,'gw-feature-grid');
 for(const e of rows){
  const card=make('article',undefined,'gw-feature-card');
  card.append(make('strong',e.name),make('small',e.role));
  const earned=badges.filter(b=>b.test(e,totals.get(String(e.id))));
  const ribbon=make('div',undefined,'gw-achievement-badges');
  for(const b of earned){const badge=make('span',b.icon+' '+b.name,'gw-achievement-badge');ribbon.append(badge);}
  if(!earned.length)card.append(make('p','No milestone badges earned yet.'));
  card.append(ribbon);grid.append(card);
 }
 if(!rows.length)grid.append(make('p','No active employees available.'));
 host.append(grid);
}
export function getDashboardSettings(employeeId){
 const key='gw-dashboard-widgets-'+String(employeeId||'guest');
 const defaults=['notifications','stats','working','performers','recognition','achievements'];
 try{
  const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(Array.isArray(saved)&&saved.every(x=>defaults.includes(x)))return [...new Set([...saved,...defaults.filter(x=>!saved.includes(x))])];
 }catch(e){}
 return defaults;
}
export function dashboardSettingsEditor(host,{employeeId,make,refresh}){
 const key='gw-dashboard-widgets-'+String(employeeId||'guest');
 const labels={notifications:'Notifications',stats:'Employee Statistics',working:'Currently Working',performers:'Top Performers',recognition:'Recent Recognition',achievements:'Employee Achievements'};
 const settings=getDashboardSettings(employeeId);
 const orderKey='gw-dashboard-hidden-'+String(employeeId||'guest');
 let hidden=[];
 try{hidden=JSON.parse(localStorage.getItem(orderKey)||'[]');if(!Array.isArray(hidden))hidden=[];}catch(e){}
 const form=make('div',undefined,'gw-feature-card');
 form.append(make('strong','Customize Your Dashboard'),make('p','Choose the sections you want to see and move them up or down. Settings are saved in this browser for your employee account.'));
 const rows=make('div',undefined,'gw-dashboard-preferences');
 const draw=()=>{
  rows.replaceChildren();
  for(const [i,id] of settings.entries()){
   const row=make('div',undefined,'gw-dashboard-preference');
   const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=!hidden.includes(id);toggle.setAttribute('aria-label','Show '+labels[id]);
   toggle.onchange=()=>{hidden=toggle.checked?hidden.filter(x=>x!==id):[...hidden,id];localStorage.setItem(orderKey,JSON.stringify(hidden));refresh();};
   const label=make('span',labels[id]);const up=make('button','↑','outline'),down=make('button','↓','outline');
   up.title='Move up';down.title='Move down';up.disabled=i===0;down.disabled=i===settings.length-1;
   const move=j=>{[settings[i],settings[j]]=[settings[j],settings[i]];localStorage.setItem(key,JSON.stringify(settings));refresh();};
   up.onclick=()=>move(i-1);down.onclick=()=>move(i+1);
   row.append(toggle,label,up,down);rows.append(row);
  }
 };
 draw();form.append(rows);host.append(form);
}
export function isDashboardWidgetVisible(employeeId,id){
 try{return !(JSON.parse(localStorage.getItem('gw-dashboard-hidden-'+String(employeeId||'guest'))||'[]')).includes(id);}catch{return true;}
}
