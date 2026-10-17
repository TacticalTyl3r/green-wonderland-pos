// Optional read-only PIN session health panel, isolated from core POS and Security Center controls.
export async function showSessionHealth(host,{call,token,make}){
 const panel=make('section',undefined,'gw-feature-card');
 panel.append(make('h3','PIN Session Health'));
 const status=make('p','Checking session status…','gw-mdt-message');
 const stats=make('div',undefined,'gw-mdt-stats');
 const advice=make('p','','gw-mdt-message');
 const refresh=make('button','Refresh Session Health','outline');
 refresh.type='button';
 panel.append(status,stats,advice,refresh);
 host.append(panel);
 const load=async()=>{
  refresh.disabled=true;
  status.textContent='Checking session status…';
  try{
   const rows=await call('gw_security_overview',{p_token:token()});
   if(!panel.isConnected)return;
   const now=Date.now();
   const sessions=(rows||[]).filter(row=>row.session_id&&Date.parse(row.session_expires_at)>now);
   const expiring=sessions.filter(row=>Date.parse(row.session_expires_at)-now<=60*60*1000);
   const locks=(rows||[]).filter(row=>row.locked_until&&Date.parse(row.locked_until)>now);
   const uniqueEmployees=new Set(sessions.map(row=>row.employee_id));
   stats.replaceChildren();
   for(const [label,value] of [['Active Sessions',sessions.length],['Signed-In Employees',uniqueEmployees.size],['Expiring Within 1 Hour',expiring.length],['Currently Locked Accounts',new Set(locks.map(row=>row.employee_id)).size]]){
    const card=make('div',undefined,'gw-mdt-stat');
    card.append(make('small',label),make('strong',String(value)));
    stats.append(card);
   }
   status.textContent='Session health checked '+new Date(now).toLocaleString()+'.';
   advice.textContent=expiring.length
    ? expiring.map(row=>row.employee_name+' expires '+new Date(row.session_expires_at).toLocaleString()).join(' · ')
    : 'No active sessions are scheduled to expire within the next hour.';
  }catch(error){
   if(panel.isConnected)status.textContent='Session health unavailable: '+(error?.message||String(error));
  }finally{refresh.disabled=false;}
 };
 refresh.onclick=load;
 await load();
}
