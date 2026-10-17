// Single optional, read-only security overview. Existing Boss session controls remain in phase3-tools.js.
export async function showSessionHealth(host,{call,token,make}){
 // A second navigation render must replace, never duplicate, the overview.
 for(const previous of host.querySelectorAll('[data-gw-session-security-overview]'))previous.remove();
 const panel=make('section',undefined,'gw-feature-card');
 panel.dataset.gwSessionSecurityOverview='true';
 const title=make('h3','Session & Security Overview');
 const description=make('p','One summary of current PIN sessions, failed attempts and lockouts. Manage individual sessions using the employee controls above.');
 const status=make('p','Loading security overview…','gw-mdt-message');
 const stats=make('div',undefined,'gw-mdt-stats');
 const attention=make('div',undefined,'gw-audit-list');
 const refresh=make('button','Refresh Security Overview','outline');
 refresh.type='button';
 panel.append(title,description,status,stats,attention,refresh);
 host.append(panel);
 const load=async()=>{
  refresh.disabled=true;
  status.textContent='Loading security overview…';
  try{
   const sessionToken=token();
   if(!sessionToken)throw Error('Boss PIN sign-in required');
   const rows=await call('gw_security_overview',{p_token:sessionToken});
   if(!panel.isConnected)return;
   const now=Date.now();
   const accounts=new Map();
   for(const row of rows||[])if(!accounts.has(row.employee_id))accounts.set(row.employee_id,row);
   const employees=[...accounts.values()];
   const sessions=(rows||[]).filter(row=>row.session_id&&Date.parse(row.session_expires_at)>now);
   const expiring=sessions.filter(row=>Date.parse(row.session_expires_at)-now<=3600000);
   const attempted=employees.filter(row=>Number(row.failed_attempts)>0);
   const locked=employees.filter(row=>row.locked_until&&Date.parse(row.locked_until)>now);
   const signedIn=new Set(sessions.map(row=>row.employee_id)).size;
   stats.replaceChildren();
   for(const [label,value] of [
    ['Active Sessions',sessions.length],
    ['Signed-In Employees',signedIn],
    ['Expiring Within 1 Hour',expiring.length],
    ['Accounts With Failed Attempts',attempted.length],
    ['Active PIN Lockouts',locked.length]
   ]){
    const card=make('div',undefined,'gw-mdt-stat');
    card.append(make('small',label),make('strong',String(value)));
    stats.append(card);
   }
   attention.replaceChildren();
   if(expiring.length){
    const line=make('p','Expiring soon: '+expiring.map(row=>row.employee_name+' ('+new Date(row.session_expires_at).toLocaleString()+')').join(' · '));
    attention.append(line);
   }
   if(locked.length){
    const line=make('p','Locked accounts: '+locked.map(row=>row.employee_name+' (until '+new Date(row.locked_until).toLocaleString()+')').join(' · '));
    attention.append(line);
   }
   const pending=attempted.filter(row=>!locked.some(item=>item.employee_id===row.employee_id));
   if(pending.length)attention.append(make('p','Current failed PIN counters: '+pending.map(row=>row.employee_name+' ('+Number(row.failed_attempts)+')').join(' · ')));
   if(!attention.children.length)attention.append(make('p','No current PIN lockouts, failed attempt counters, or sessions expiring within an hour.'));
   status.textContent='Last checked '+new Date(now).toLocaleString()+'. Failed-attempt counters are not a historical login log.';
  }catch(error){
   if(panel.isConnected)status.textContent='Session overview unavailable: '+(error?.message||String(error));
  }finally{refresh.disabled=false;}
 };
 refresh.onclick=load;
 await load();
}
