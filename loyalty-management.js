// Green Wonderland Loyalty & Rewards management. Every read/write uses a permission-checked RPC.
export async function renderLoyaltyManagement(host,{call,token,canFeature,cash,make}){
 host.replaceChildren();
 const heading=make('div',undefined,'gw-mdt-head');
 heading.append(make('h2','Loyalty & Rewards'),make('p','Search customers by CID or name, view their rewards history, and manage points with an audit trail.'));
 const status=make('p','Loading loyalty customers…','gw-mdt-message');
 const controls=make('div',undefined,'gw-mdt-actions'),search=document.createElement('input'),reload=make('button','Refresh','outline');
 search.type='search';search.placeholder='Search Customer CID or name';search.setAttribute('aria-label','Search loyalty members');
 controls.append(search,reload);
 const stats=make('div',undefined,'gw-mdt-stats');
 const layout=make('div',undefined,'gw-loyalty-layout');
 const directory=make('section',undefined,'gw-loyalty-directory');
 const profile=make('section',undefined,'gw-loyalty-profile');
 profile.append(make('p','Select a customer to see their rewards profile and history.'));
 layout.append(directory,profile);host.append(heading,controls,status,stats,layout);
 const rpc=(name,args={})=>call(name,{p_token:token(),...args});
 const canEdit=()=>canFeature('loyalty_adjust');
 let members=[],selectedId=null,request=0;
 const showDetails=async member=>{
  selectedId=member.id;profile.replaceChildren();
  for(const el of directory.querySelectorAll('[data-loyalty-member]'))el.classList.toggle('selected',el.dataset.loyaltyMember===String(member.id));
  const title=make('div',undefined,'gw-loyalty-profile-head');
  const info=make('div');info.append(make('small','CUSTOMER REWARDS PROFILE'),make('h3',member.display_name),make('p','CID: '+member.member_code));
  const balance=make('div',undefined,'gw-loyalty-points');balance.append(make('strong',String(member.points)),make('small','Available points'));
  title.append(info,balance);profile.append(title);
  const cards=make('div',undefined,'gw-mdt-stats');
  for(const [label,value] of [['Lifetime Points Earned',String(member.lifetime_earned)],['Reward Purchases',String(member.orders)],
   ['Purchase Total',cash(member.total_spent)],['Member Since',new Date(member.created_at).toLocaleDateString()]]){
   const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',value));cards.append(card);
  }
  profile.append(cards);
  if(canEdit()){
   const form=make('form',undefined,'gw-loyalty-adjust-form');
   form.append(make('h4','Adjust Reward Points'),make('p','Every manual adjustment records the signed-in employee, date, amount and required reason.'));
   const amount=document.createElement('input');amount.type='number';amount.step='1';amount.min='-10000';amount.max='10000';
   amount.placeholder='Points to add or remove (e.g. 10 or -5)';amount.required=true;
   const reason=document.createElement('textarea');reason.rows=2;reason.maxLength=500;reason.minLength=5;reason.required=true;
   reason.placeholder='Reason for point adjustment (minimum 5 characters)';
   const submit=make('button','Save Point Adjustment','primary');submit.type='submit';
   const message=make('p','','gw-mdt-message');form.append(amount,reason,submit,message);
   form.onsubmit=async ev=>{
    ev.preventDefault();
    const delta=Number(amount.value);
    if(!Number.isInteger(delta)||delta===0){message.textContent='Enter a nonzero whole number of points.';return;}
    if(!confirm('Adjust '+member.display_name+' (CID '+member.member_code+') by '+(delta>0?'+':'')+delta+' points?'))return;
    submit.disabled=true;message.textContent='Saving adjustment…';
    try{
     await rpc('gw_loyalty_adjust_points',{p_member:member.id,p_delta:delta,p_reason:reason.value.trim()});
     await loadMembers(member.id);
     status.textContent='Points adjusted. A permanent audit record was created.';
    }catch(error){message.textContent='Unable to adjust points: '+error.message;submit.disabled=false;}
   };
   profile.append(form);
  }
  const section=make('div',undefined,'gw-loyalty-activity');
  section.append(make('h3','Purchases & Rewards History'));
  const entries=make('div',undefined,'gw-loyalty-activity-list');
  section.append(entries);profile.append(section);
  try{
   const rows=await rpc('gw_loyalty_member_activity',{p_member:member.id});
   if(selectedId!==member.id)return;
   if(!rows.length){entries.append(make('p','No reward activity recorded yet.'));return;}
   for(const event of rows){
    const card=make('article',undefined,'gw-loyalty-activity-card');
    const top=make('div',undefined,'gw-loyalty-activity-top');
    const isPurchase=event.entry_type==='purchase',value=isPurchase?cash(event.amount):(Number(event.points_delta)>0?'+':'')+Number(event.points_delta)+' pts';
    top.append(make('strong',isPurchase?'Purchase':event.note||'Points activity'),make('strong',value));
    if(!isPurchase)card.classList.add(Number(event.points_delta)>=0?'gw-loyalty-positive':'gw-loyalty-negative');
    card.append(top,make('small',new Date(event.entry_date).toLocaleString()+' · '+(event.performed_by||'Unknown employee')));
    if(isPurchase){
     const items=Array.isArray(event.items)?event.items:[];
     if(items.length)for(const item of items){
      card.append(make('p',Number(item.qty||0)+'× '+(item.name||'Item')+(item.choice?' · '+item.choice:'')+(item.total!=null?' · '+cash(item.total):'')));
     }else card.append(make('p','Itemized receipt unavailable'));
    }else if(event.sale_id)card.append(make('small','Sale: '+event.sale_id));
    entries.append(card);
   }
  }catch(error){entries.append(make('p','Unable to load reward activity: '+error.message));}
 };
 const draw=()=>{
  directory.replaceChildren();stats.replaceChildren();
  for(const [label,val] of [['Customers',members.length],
   ['Available Points',members.reduce((n,m)=>n+Number(m.points||0),0)],
   ['Lifetime Points Earned',members.reduce((n,m)=>n+Number(m.lifetime_earned||0),0)]]){
   const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',String(val)));stats.append(card);
  }
  for(const member of members){
   const card=make('button',undefined,'gw-loyalty-member-card');
   card.type='button';card.dataset.loyaltyMember=member.id;
   const info=make('div');info.append(make('strong',member.display_name),make('small','CID '+member.member_code+' · '+member.orders+' purchases'));
   const balance=make('span',member.points+' pts','gw-loyalty-member-points');
   card.append(info,balance);card.onclick=()=>showDetails(member);
   if(selectedId===member.id)card.classList.add('selected');directory.append(card);
  }
  if(!members.length)directory.append(make('p','No matching loyalty customers found.'));
 };
 async function loadMembers(select=null){
  const id=++request;status.textContent='Loading loyalty customers…';
  try{
   const rows=await rpc('gw_loyalty_members_admin',{p_query:search.value.trim()});
   if(id!==request)return;
   members=rows||[];draw();
   const chosen=members.find(m=>m.id===(select||selectedId));
   if(chosen)await showDetails(chosen);
   else if(members.length===1)await showDetails(members[0]);
   else{selectedId=null;profile.replaceChildren(make('p','Select a customer to see their rewards profile and history.'));}
   status.textContent=members.length+' customers shown (up to 200 per search).';
  }catch(error){status.textContent='Loyalty management requires its SQL migration and an authorized employee PIN: '+error.message;}
 }
 let debounce;
 search.oninput=()=>{clearTimeout(debounce);debounce=setTimeout(()=>loadMembers(),240);};
 reload.onclick=()=>loadMembers(selectedId);
 await loadMembers();
}
