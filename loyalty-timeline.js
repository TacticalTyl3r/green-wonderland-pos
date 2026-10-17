// Optional, isolated customer loyalty history panel.
// A failure in this module must not block sign-in, clock-in, or navigation.
export async function renderPointsTimeline(host,{member,call,token,make,download,isCurrent}){
 const panel=make('section',undefined,'gw-loyalty-activity');
 panel.append(make('h3','Complete Points & Redemption Timeline'));
 const message=make('p','Loading points history…','gw-mdt-message');
 const metrics=make('div',undefined,'gw-mdt-stats');
 const exportButton=make('button','Export Points Timeline CSV','outline');
 exportButton.type='button';exportButton.disabled=true;
 const entries=make('div',undefined,'gw-loyalty-activity-list');
 panel.append(message,metrics,exportButton,entries);
 host.append(panel);
 try{
  const result=await call('gw_loyalty_management_timeline',{p_token:token(),p_member:member.id});
  if(!isCurrent())return;
  const rows=Array.isArray(result)?result:[];
  const catalog=rows.filter(item=>item.event_type==='catalog_redemption');
  const manual=rows.filter(item=>item.event_type==='manual_adjustment');
  const refund=rows.filter(item=>item.event_type==='refund_reconciliation');
  const cards=[
   ['Catalog Redemptions',catalog.length],
   ['Catalog Points Spent',catalog.reduce((sum,item)=>sum+Math.abs(Number(item.points_change)||0),0)],
   ['Manual Adjustments',manual.length],
   ['Refund / Void Events',refund.length]
  ];
  for(const [label,value] of cards){
   const card=make('div',undefined,'gw-mdt-stat');
   card.append(make('small',label),make('strong',String(value)));
   metrics.append(card);
  }
  message.textContent=rows.length+' recent points events (maximum 500). The counts below cover displayed events only.';
  exportButton.disabled=rows.length===0;
  exportButton.onclick=()=>download('gw-points-'+String(member.member_code).replace(/[^a-z0-9_-]/gi,'_')+'.csv',
   [['Date','Type','Description','Points Change','Employee','Reference'],
    ...rows.map(item=>[item.event_date,item.event_type,item.description||'',item.points_change,
     item.performed_by||'',item.reference||''])]);
  const labels={
   manual_adjustment:'Manual adjustment',
   catalog_redemption:'Catalog reward redeemed',
   refund_reconciliation:'Refund / void reconciliation',
   points_spent:'Points spent',
   points_earned:'Points earned'
  };
  for(const item of rows){
   const points=Number(item.points_change)||0;
   const card=make('article',undefined,'gw-loyalty-activity-card');
   card.classList.add(points<0?'gw-loyalty-negative':'gw-loyalty-positive');
   const header=make('div',undefined,'gw-loyalty-activity-top');
   header.append(make('strong',labels[item.event_type]||'Points activity'),
    make('strong',(points>0?'+':'')+points+' pts'));
   card.append(header,make('p',item.description||'No description recorded'),
    make('small',new Date(item.event_date).toLocaleString()+' · '+(item.performed_by||'System')+
     (item.reference?' · Ref: '+item.reference:'')));
   entries.append(card);
  }
  if(!rows.length)entries.append(make('p','No points activity recorded for this CID.'));
 }catch(error){
  if(isCurrent())message.textContent='Unable to load points timeline: '+(error?.message||String(error));
 }
}
