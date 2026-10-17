// Read-only Boss security monitoring. Loads only from the optional session-insights module.
// Reports current failed-PIN counters, not a historical sign-in attempt timeline.
export async function showSecurityMonitoring(host,{call,token,make}){
 const panel=make('section',undefined,'gw-feature-card');
 const title=make('h3','PIN Security Monitoring');
 const description=make('p','Review current failed PIN counters, active lockouts and recent administrative security actions.');
 const status=make('p','Loading security monitoring…','gw-mdt-message');
 const metrics=make('div',undefined,'gw-mdt-stats');
 const accountList=make('div',undefined,'gw-audit-list');
 const heading=make('h4','Accounts Requiring Attention');
 const activityHeading=make('h4','Recent Security Actions');
 const activity=make('div',undefined,'gw-audit-list');
 const refresh=make('button','Refresh Security Monitoring','outline');
 refresh.type='button';
 panel.append(title,description,status,metrics,heading,accountList,activityHeading,activity,refresh);
 host.append(panel);
 const load=async()=>{
  refresh.disabled=true;status.textContent='Loading security monitoring…';
  try{
   const sessionToken=token();
   if(!sessionToken)throw Error('Boss employee PIN session required');
   const [allSessions,events]=await Promise.all([
    call('gw_security_overview',{p_token:sessionToken}),
    call('gw_security_events_list',{p_token:sessionToken})
   ]);
   if(!panel.isConnected)return;
   const byEmployee=new Map();
   for(const record of allSessions||[]){
    if(!byEmployee.has(record.employee_id))byEmployee.set(record.employee_id,record);
   }
   const employees=[...byEmployee.values()];
   const now=Date.now();
   const attempted=employees.filter(employee=>Number(employee.failed_attempts)>0);
   const locked=employees.filter(employee=>employee.locked_until&&Date.parse(employee.locked_until)>now);
   const recent=(events||[]).filter(event=>Date.parse(event.created_at)>=now-7*86400000);
   metrics.replaceChildren();accountList.replaceChildren();activity.replaceChildren();
   for(const [label,value] of [
    ['Accounts With Failed Attempts',attempted.length],
    ['Active PIN Lockouts',locked.length],
    ['Recorded Security Actions (7 Days)',recent.length],
    ['Total Accounts Reviewed',employees.length]
   ]){
    const metric=make('div',undefined,'gw-mdt-stat');
    metric.append(make('small',label),make('strong',String(value)));
    metrics.append(metric);
   }
   for(const employee of attempted.filter(item=>!locked.some(lock=>lock.employee_id===item.employee_id)).concat(locked)){
    const isLocked=locked.some(lock=>lock.employee_id===employee.employee_id);
    const card=make('article',undefined,'gw-audit-card');
    const info=make('div',undefined,'gw-audit-card-body');
    info.append(make('strong',employee.employee_name+' · '+employee.employee_role),
     make('p',isLocked?'PIN locked until '+new Date(employee.locked_until).toLocaleString():
      Number(employee.failed_attempts)+' unsuccessful PIN attempt(s) currently recorded.'));
    card.append(info);accountList.append(card);
   }
   if(!accountList.children.length)accountList.append(make('p','No current failed PIN counters or active lockouts.'));
   for(const event of (events||[]).slice(0,15)){
    const card=make('article',undefined,'gw-audit-card');
    const info=make('div',undefined,'gw-audit-card-body');
    info.append(make('strong',String(event.event_type||'Security action').replaceAll('_',' ')),
     make('p',event.details||'No details recorded'),
     make('small',(event.actor_name||'Unknown')+' → '+(event.target_name||'Unknown')+' · '+new Date(event.created_at).toLocaleString()));
    card.append(info);activity.append(card);
   }
   if(!activity.children.length)activity.append(make('p','No recorded administrative security actions.'));
   status.textContent='Last checked '+new Date(now).toLocaleString()+' · Failed-attempt counts reset after a successful PIN sign-in or a Boss reset.';
  }catch(error){
   if(panel.isConnected)status.textContent='Security monitoring unavailable: '+(error?.message||String(error));
  }finally{refresh.disabled=false;}
 };
 refresh.onclick=load;
 await load();
}
