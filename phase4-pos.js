// Phase 4 POS enhancements: offers, favorites and loyalty preview.
// Prices and points are authoritative only after gw_pos_checkout_v4 validates them.
export function createPhase4({db,money,getProducts,getLines,getToken,onCartChanged}){
 let offers=[],ready=false,member=null,redeem=0,favorites=[];
 try{favorites=JSON.parse(localStorage.getItem('gw-pos-favorites')||'[]');if(!Array.isArray(favorites))favorites=[];}catch(e){}
 const root=document.createElement('section');root.className='gw-phase4-checkout';
 const favoritesRoot=document.createElement('section');favoritesRoot.className='gw-pos-favorites';
 const token=()=>getToken();
 const rpc=async(name,args={})=>{if(!db)throw Error('Supabase is not configured');const {data,error}=await db.rpc(name,args);if(error)throw Error(error.message);return data;};
 const refreshOffers=async()=>{try{offers=await rpc('gw_pos_active_offers');ready=true;}catch(e){offers=[];ready=false;}onCartChanged();};
 const specials=id=>offers.filter(o=>o.offer_type==='special'&&String(o.product_id)===String(id));
 const bestSpecial=id=>Math.max(0,...specials(id).map(o=>Number(o.percent_off)||0));
 const eligibleBundles=()=>offers.filter(o=>o.offer_type==='bundle'&&Array.isArray(o.items));
 const preview=()=>{
  const lines=getLines(),subtotal=lines.reduce((n,l)=>n+Number(l.p.price)*l.qty,0);
  const specialDiscount=lines.reduce((n,l)=>n+Number(l.p.price)*l.qty*bestSpecial(l.p.id)/100,0);
  let bestBundle=0;
  const bundleDetails=[];
  for(const o of eligibleBundles()){
   if(!o.items.length)continue;
   let sets=Infinity,gross=0;
   for(const item of o.items){
    const required=Number(item.qty)||1,matching=lines.filter(l=>String(l.p.id)===String(item.id));
    const count=matching.reduce((sum,l)=>sum+l.qty,0);
    sets=Math.min(sets,Math.floor(count/required));
    gross+=(Number(matching[0]?.p.price)||0)*required;
   }
   if(sets>0&&Number.isFinite(sets)){
    const discount=Math.max(0,(gross-Number(o.bundle_price))*sets);
    bestBundle=Math.max(bestBundle,discount);
    bundleDetails.push(o.title+' × '+sets);
   }
  }
  return{subtotal,discount:Math.min(subtotal,Math.round(Math.max(specialDiscount,bestBundle)*100)/100),bundles:bundleDetails};
 };
 const setMember=m=>{member=m;redeem=0;render();onCartChanged();};
 const estimateRedemption=(due)=>Math.min(Math.max(0,Math.floor(due)),member?.points||0,redeem);
 const render=()=>{
  root.replaceChildren();
  const heading=document.createElement('div');heading.className='gw-phase4-heading';
  heading.innerHTML='<strong>✦ CUSTOMER REWARDS</strong><small>1 point per $100 spent · 1 point = $1 off</small>';root.append(heading);
  const field=document.createElement('div');field.className='gw-phase4-field';
  const code=document.createElement('input');code.placeholder='Customer reward code';code.maxLength=40;code.setAttribute('aria-label','Loyalty member code');
  const find=document.createElement('button');find.className='outline';find.textContent='Find Member';
  const create=document.createElement('button');create.className='outline';create.textContent='+ Enroll';
  field.append(code,find,create);root.append(field);
  const status=document.createElement('p');status.className='gw-phase4-status';root.append(status);
  const fetchMember=async()=>{if(!token())throw Error('Employee PIN sign-in required');const rows=await rpc('gw_loyalty_find',{p_token:token(),p_code:code.value.trim()});if(!rows.length)throw Error('Member not found');setMember(rows[0]);};
  find.onclick=async()=>{try{await fetchMember();}catch(e){status.textContent=e.message;}};
  create.onclick=async()=>{const name=prompt('Enter customer display name:');if(name===null)return;
   try{await rpc('gw_loyalty_register',{p_token:token(),p_code:code.value.trim(),p_name:name.trim()});await fetchMember();}
   catch(e){status.textContent=e.message;}
  };
  if(member){
   const info=document.createElement('div');info.className='gw-loyalty-member';
   const text=document.createElement('div');text.innerHTML='<strong></strong><small></small>';text.querySelector('strong').textContent=member.display_name+' · '+member.member_code;
   text.querySelector('small').textContent=member.points+' points available';
   const remove=document.createElement('button');remove.className='outline';remove.textContent='Remove';remove.onclick=()=>setMember(null);
   info.append(text,remove);root.append(info);
   const label=document.createElement('label');label.className='gw-loyalty-redeem';label.textContent='Points to redeem (1 point = $1)';
   const entry=document.createElement('input');entry.type='number';entry.min='0';entry.step='1';entry.max=String(member.points);entry.value=String(redeem);
   entry.oninput=()=>{redeem=Math.min(member.points,Math.max(0,Math.floor(Number(entry.value)||0)));onCartChanged();};
   label.append(entry);root.append(label);
  }
  const offerInfo=document.createElement('div');offerInfo.className='gw-pos-offer-list';
  const p=preview();
  offerInfo.innerHTML='<strong>Active deals</strong>';
  for(const o of offers){
   const line=document.createElement('span');line.textContent=o.title+(o.offer_type==='special'?' · '+o.percent_off+'% off':' · Bundle '+money(o.bundle_price));
   offerInfo.append(line);
  }
  if(!offers.length){const empty=document.createElement('small');empty.textContent=ready?'No specials or bundles active':'Offers available after the Phase 4 SQL migration';offerInfo.append(empty);}
  root.append(offerInfo);
 };
 const renderFavorites=choose=>{
  favoritesRoot.replaceChildren();
  const title=document.createElement('div');title.className='gw-phase4-heading';title.innerHTML='<strong>★ QUICK FAVORITES</strong><small>Saved in this browser</small>';favoritesRoot.append(title);
  const row=document.createElement('div');row.className='gw-favorite-items';
  for(const id of favorites){
   const p=getProducts().find(p=>String(p.id)===String(id)&&p.active);if(!p)continue;
   const btn=document.createElement('button');btn.className='outline';btn.textContent='+ '+p.name;btn.onclick=()=>choose(p);row.append(btn);
  }
  if(!row.children.length){const hint=document.createElement('small');hint.textContent='Select ☆ on a catalog item to pin it here.';row.append(hint);}
  favoritesRoot.append(row);
 };
 const toggleFavorite=id=>{
  id=String(id);
  favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id].slice(-24);
  localStorage.setItem('gw-pos-favorites',JSON.stringify(favorites));onCartChanged();
 };
 const checkout=async({items,fulfillment,zone,discount,employee,expectedTotal})=>{
  if(!ready)throw Error('Phase 4 SQL migration is not installed or offers are not available');
  const rows=await rpc('gw_pos_checkout_v4',{p_token:token(),p_employee:employee||null,
   p_items:items,p_fulfillment:fulfillment,p_zone:zone||null,p_manual_percent:discount,
   p_member:member?.id||null,p_redeem:redeem,p_expected_total:expectedTotal});
  if(!rows?.length)throw Error('Checkout did not return a sale');
  const result=rows[0];
  if(member){
   member={...member,points:member.points-result.points_redeemed+result.points_earned};
   redeem=0;render();
  }
  return result;
 };
 return {root,favoritesRoot,render,renderFavorites,refreshOffers,toggleFavorite,checkFavorite:id=>favorites.includes(String(id)),
  bestSpecial,preview,estimateRedemption,checkout,isReady:()=>ready,getMember:()=>member,getRedeem:()=>redeem,clearMember:()=>setMember(null)};
}
