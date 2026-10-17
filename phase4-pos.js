// Phase 4 POS enhancements: offers, favorites and loyalty preview.
// Prices and points are authoritative only after gw_pos_checkout_v4 validates them.
export function createPhase4({db,money,getProducts,getLines,getToken,onCartChanged}){
 let offers=[],ready=false,member=null,redeem=0,favorites=[],catalogRewards=[],catalogReady=false;
 let loyaltyConfig={earn_per_amount:100,point_value:1,enabled:true},loyaltyConfigReady=false;
 try{favorites=JSON.parse(localStorage.getItem('gw-pos-favorites')||'[]');if(!Array.isArray(favorites))favorites=[];}catch(e){}
 const root=document.createElement('section');root.className='gw-phase4-checkout';
 const checkoutRewards=document.createElement('section');checkoutRewards.className='gw-checkout-rewards';
 const favoritesRoot=document.createElement('section');favoritesRoot.className='gw-pos-favorites';
 const token=()=>getToken();
 const rpc=async(name,args={})=>{if(!db)throw Error('Supabase is not configured');const {data,error}=await db.rpc(name,args);if(error)throw Error(error.message);return data;};
 const refreshOffers=async()=>{try{try{offers=await rpc('gw_pos_active_offers_v2');}catch(e){offers=await rpc('gw_pos_active_offers');}ready=true;}catch(e){offers=[];ready=false;}onCartChanged();};
 const refreshLoyaltyConfig=async()=>{if(!token()){loyaltyConfigReady=false;return;}try{const rows=await rpc('gw_loyalty_checkout_config',{p_token:token()});const config=Array.isArray(rows)?rows[0]:rows;if(!config)throw Error('Missing loyalty configuration');loyaltyConfig=config;loyaltyConfigReady=true;}catch(e){loyaltyConfigReady=false;}render();onCartChanged();};
 const specials=id=>offers.filter(o=>o.offer_type==='special'&&(String(o.product_id)===String(id)||(Array.isArray(o.items)&&o.items.some(item=>String(item.id)===String(id)))));
 const bestSpecial=id=>Math.max(0,...specials(id).map(o=>Number(o.percent_off)||0));
 const eligibleBundles=()=>offers.filter(o=>o.offer_type==='bundle'&&Array.isArray(o.items));
 const preview=()=>{
  const lines=getLines(),subtotal=lines.reduce((n,l)=>n+Number(l.p.price)*l.qty,0);
  const specialDiscount=lines.reduce((n,l)=>n+Number(l.p.price)*l.qty*bestSpecial(l.p.id)/100,0);
  let bestBundle=0,appliedBundle='';
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
    if(discount>bestBundle){bestBundle=discount;appliedBundle=o.title+' × '+sets;}
    bundleDetails.push(o.title+' × '+sets);
   }
  }
  return{subtotal,discount:Math.min(subtotal,Math.round(Math.max(specialDiscount,bestBundle)*100)/100),bundles:bundleDetails,
   applied:bestBundle>specialDiscount?appliedBundle:specialDiscount>0?'Product specials':''};
 };
 const refreshCatalogRewards=async()=>{if(!token()){catalogRewards=[];catalogReady=false;return;}try{catalogRewards=await rpc('gw_pos_catalog_rewards',{p_token:token()});catalogReady=true;}catch(e){catalogRewards=[];catalogReady=false;}render();};
 const setMember=m=>{member=m;redeem=0;render();onCartChanged();if(m)refreshCatalogRewards();};
 const applicablePoints=due=>loyaltyConfigReady&&Number(loyaltyConfig.point_value)>0?Math.max(0,Math.min(Math.max(0,Math.floor(member?.points||0)),redeem,Math.floor((Math.max(0,Number(due)||0)+0.000001)/Number(loyaltyConfig.point_value)))):0;
 const estimateRedemption=due=>Math.round(applicablePoints(due)*Number(loyaltyConfig.point_value)*100)/100;
 const renderCheckoutRewards=()=>{
  checkoutRewards.replaceChildren();
  const title=document.createElement('strong');title.textContent='Loyalty at Checkout';checkoutRewards.append(title);
  if(!member){const hint=document.createElement('small');hint.textContent='Find a customer CID above to apply or redeem loyalty points.';checkoutRewards.append(hint);return;}
  const info=document.createElement('small');info.textContent=member.display_name+' · '+member.points+' points available';checkoutRewards.append(info);
  const row=document.createElement('div');row.className='gw-checkout-rewards-actions';
  const points=document.createElement('input');points.type='number';points.min='0';points.step='1';points.max=String(Math.max(0,member.points));points.value=String(redeem);points.setAttribute('aria-label','Points to redeem against checkout total');
  points.oninput=()=>{redeem=Math.max(0,Math.min(Math.max(0,member.points),Math.floor(Number(points.value)||0)));const other=root.querySelector('.gw-loyalty-redeem input');if(other)other.value=String(redeem);onCartChanged();};
  const max=document.createElement('button');max.type='button';max.className='outline';max.textContent='Use All Points';max.onclick=()=>{redeem=Math.max(0,Math.floor(member.points));points.value=String(redeem);const other=root.querySelector('.gw-loyalty-redeem input');if(other)other.value=String(redeem);onCartChanged();};
  row.append(points,max);checkoutRewards.append(row);
  const note=document.createElement('small');note.textContent='Points discount applies when you complete checkout. Catalog rewards are redeemed separately below.';checkoutRewards.append(note);
  if(catalogReady&&catalogRewards.length){
   const selection=document.createElement('select');selection.setAttribute('aria-label','Choose catalog reward');
   const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select catalog reward';selection.append(placeholder);
   for(const reward of catalogRewards){const option=document.createElement('option');option.value=reward.id;option.textContent=reward.title+' — '+reward.points_cost+' pts';option.disabled=Number(member.points)<Number(reward.points_cost);selection.append(option);}
   const redeemButton=document.createElement('button');redeemButton.type='button';redeemButton.className='outline';redeemButton.textContent='Redeem Reward';
   redeemButton.onclick=async()=>{
    const reward=catalogRewards.find(x=>x.id===selection.value);if(!reward)return;
    if(!confirm('Redeem '+reward.title+' for '+reward.points_cost+' points for '+member.display_name+'?'))return;
    redeemButton.disabled=true;
    try{
     const rows=await rpc('gw_pos_redeem_catalog_reward',{p_token:token(),p_member:member.id,p_reward:reward.id});
     const result=Array.isArray(rows)?rows[0]:rows;
     if(!result||!Number.isFinite(Number(result.points_remaining)))throw Error('Redemption response was incomplete');
     member={...member,points:Number(result.points_remaining)};redeem=Math.min(redeem,Math.max(0,member.points));
     render();onCartChanged();alert('Reward redeemed. Remaining points: '+member.points);
    }catch(e){alert('Reward not redeemed: '+e.message);redeemButton.disabled=false;}
   };
   const catalogRow=document.createElement('div');catalogRow.className='gw-checkout-rewards-actions';catalogRow.append(selection,redeemButton);checkoutRewards.append(catalogRow);
  }
 };
 const render=()=>{
  root.replaceChildren();renderCheckoutRewards();
  const heading=document.createElement('div');heading.className='gw-phase4-heading';
  heading.innerHTML='<strong>✦ CUSTOMER REWARDS</strong>';const rate=document.createElement('small');rate.textContent=loyaltyConfigReady?(loyaltyConfig.enabled?'Earning ON · 1 point per '+money(Number(loyaltyConfig.earn_per_amount))+' spent':'Earning OFF · no new points earned')+' · 1 point = '+money(Number(loyaltyConfig.point_value)):'Sign in to view reward rates';heading.append(rate);root.append(heading);
  const field=document.createElement('div');field.className='gw-phase4-field';
  const code=document.createElement('input');code.placeholder='Customer CID';code.maxLength=40;code.setAttribute('aria-label','Customer CID');
  const find=document.createElement('button');find.className='outline';find.textContent='Find Member';
  const create=document.createElement('button');create.className='outline';create.textContent='+ Enroll';
  field.append(code,find,create);root.append(field);
  const status=document.createElement('p');status.className='gw-phase4-status';root.append(status);
  const fetchMember=async()=>{if(!token())throw Error('Employee PIN sign-in required');await refreshLoyaltyConfig();if(!loyaltyConfigReady)throw Error('Loyalty rates unavailable; try again');const rows=await rpc('gw_loyalty_find',{p_token:token(),p_code:code.value.trim()});if(!rows.length)throw Error('Member not found');setMember(rows[0]);};
  find.onclick=async()=>{try{await fetchMember();}catch(e){status.textContent=e.message;}};
  create.onclick=async()=>{const name=prompt('Enter customer display name:');if(name===null)return;
   try{await rpc('gw_loyalty_register',{p_token:token(),p_code:code.value.trim(),p_name:name.trim()});await fetchMember();}
   catch(e){status.textContent=e.message;}
  };
  if(member){
   const info=document.createElement('div');info.className='gw-loyalty-member';
   const text=document.createElement('div');text.innerHTML='<strong></strong><small></small>';text.querySelector('strong').textContent=member.display_name+' · '+member.member_code;
   text.querySelector('small').textContent=member.points<0?'Point balance: '+member.points+' (future points first offset refunded purchases)':member.points+' points available';
   const remove=document.createElement('button');remove.className='outline';remove.textContent='Remove';remove.onclick=()=>setMember(null);
   info.append(text,remove);root.append(info);
   const label=document.createElement('label');label.className='gw-loyalty-redeem';label.textContent='Points to redeem (1 point = '+money(Number(loyaltyConfig.point_value))+')';
   const entry=document.createElement('input');entry.type='number';entry.min='0';entry.step='1';entry.max=String(Math.max(0,member.points));entry.value=String(redeem);
   entry.oninput=()=>{redeem=Math.max(0,Math.min(member.points,Math.max(0,Math.floor(Number(entry.value)||0))));renderCheckoutRewards();onCartChanged();};
   label.append(entry);root.append(label);
   const catalog=document.createElement('div');catalog.className='gw-pos-offer-list gw-catalog-rewards';
   const catalogTitle=document.createElement('strong');catalogTitle.textContent='Redeem a Catalog Reward';catalog.append(catalogTitle);
   const message=document.createElement('small');message.textContent='Catalog rewards use points separately from checkout discounts. They do not change the sale total.';catalog.append(message);
   if(!catalogReady){const hint=document.createElement('small');hint.textContent='Reward redemption is unavailable until the catalog redemption SQL is installed.';catalog.append(hint);}
   else if(!catalogRewards.length){const hint=document.createElement('small');hint.textContent='No active catalog rewards.';catalog.append(hint);}
   else for(const reward of catalogRewards){
    const row=document.createElement('div');row.className='gw-catalog-reward-row';
    const details=document.createElement('div');const name=document.createElement('strong');name.textContent=reward.title;
    const description=document.createElement('small');description.textContent=reward.points_cost+' points'+(reward.description?' · '+reward.description:'');
    details.append(name,description);
    const button=document.createElement('button');button.type='button';button.className='outline';button.textContent='Redeem';
    button.disabled=Number(member.points)<Number(reward.points_cost);
    button.onclick=async()=>{
     if(!member)return;
     if(!confirm('Redeem '+reward.title+' for '+reward.points_cost+' points for '+member.display_name+'? This is separate from checkout.'))return;
     button.disabled=true;button.textContent='Redeeming…';
     try{
      const result=await rpc('gw_pos_redeem_catalog_reward',{p_token:token(),p_member:member.id,p_reward:reward.id});
      const value=Array.isArray(result)?result[0]:result;
      if(!value||!Number.isFinite(Number(value.points_remaining)))throw Error('Reward redemption response was incomplete');
      member={...member,points:Number(value.points_remaining)};
      redeem=Math.min(redeem,Math.max(0,member.points));
      render();onCartChanged();
      alert('Redeemed '+reward.title+' for '+reward.points_cost+' points. Remaining balance: '+member.points+'.');
     }catch(e){button.disabled=false;button.textContent='Redeem';alert('Reward was not redeemed: '+e.message);}
    };
    row.append(details,button);catalog.append(row);
   }
   root.append(catalog);
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
 const checkout=async({items,fulfillment,zone,discount,employee,expectedTotal,availableDue})=>{
  if(!ready)throw Error('Phase 4 SQL migration is not installed or offers are not available');
  if(member){await refreshLoyaltyConfig();if(!loyaltyConfigReady)throw Error('Reward settings unavailable. No sale was recorded.');}
  const memberAtCheckout=member?{id:member.id,member_code:member.member_code,display_name:member.display_name,points:Number(member.points)}:null;
  const rows=await rpc('gw_pos_checkout_v4',{p_token:token(),p_employee:employee||null,
   p_items:items,p_fulfillment:fulfillment,p_zone:zone||null,p_manual_percent:discount,
   p_member:member?.id||null,p_redeem:applicablePoints(availableDue),p_expected_total:expectedTotal});
  if(!rows?.length)throw Error('Checkout did not return a sale');
  const result=rows[0];
  if(memberAtCheckout){
   const earned=Number(result.points_earned||0),spent=Number(result.points_redeemed||0);
   if(member?.id===memberAtCheckout.id){member={...member,points:memberAtCheckout.points-spent+earned};redeem=0;render();}
   result.loyalty_receipt={member_id:memberAtCheckout.id,member_code:memberAtCheckout.member_code,member_name:memberAtCheckout.display_name,points_earned:earned,points_redeemed:spent,points_remaining:memberAtCheckout.points-spent+earned};
  }
  return result;
 };
 return {root,checkoutRewards,favoritesRoot,render,renderFavorites,refreshOffers,toggleFavorite,checkFavorite:id=>favorites.includes(String(id)),
  bestSpecial,preview,getOffers:()=>offers.slice(),estimateRedemption,checkout,refreshLoyaltyConfig,isReady:()=>ready,getMember:()=>member,getRedeem:()=>redeem,clearMember:()=>setMember(null)};
}