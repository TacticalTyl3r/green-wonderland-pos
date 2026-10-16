// Boss-managed offers and item-based sales insights for Green Wonderland.
export async function showOffersManager(host,{call,token,make,cash}){
 host.replaceChildren();
 const head=make('div',undefined,'gw-mdt-head');
 head.append(make('h2','Bundles & Limited-Time Specials'),make('p','Create time-limited product discounts and multi-product bundles. Changes apply automatically to checkout after refreshing the POS.'));
 const status=make('p','Loading offers…'),list=make('div',undefined,'gw-feature-grid');
 host.append(head,status);
 const rpc=(name,args={})=>call(name,{p_token:token(),...args});
 let products=[];
 try{
  const db=await import('./config.js');
  const mod=await import('https://esm.sh/@supabase/supabase-js@2');
  const client=mod.createClient(db.SUPABASE_URL,db.SUPABASE_ANON_KEY);
  const {data,error}=await client.from('products').select('id,name,price,active').order('name');
  if(error)throw Error(error.message);products=(data||[]).filter(p=>p.active);
 }catch(e){status.textContent='Unable to load catalog: '+e.message;return;}
 const form=make('form',undefined,'gw-mdt-form gw-offer-form');
 const title=document.createElement('input');title.placeholder='Offer title';title.maxLength=100;title.required=true;
 const type=document.createElement('select');type.add(new Option('Product Special','special'));type.add(new Option('Product Bundle','bundle'));
 const product=document.createElement('select');for(const p of products)product.add(new Option(p.name+' · '+cash(p.price),String(p.id)));
 const percent=document.createElement('input');percent.type='number';percent.min='.01';percent.max='100';percent.step='.01';percent.placeholder='Percent off';percent.value='10';
 const bundlePrice=document.createElement('input');bundlePrice.type='number';bundlePrice.min='0';bundlePrice.step='.01';bundlePrice.placeholder='Bundle price';
 const parts=make('div',undefined,'gw-bundle-parts');const addPart=make('button','+ Add Bundle Item','outline');addPart.type='button';
 let partRows=[];
 const add=({id,qty}={})=>{
  const wrap=make('div',undefined,'gw-phase4-field'),item=document.createElement('select'),quantity=document.createElement('input'),remove=make('button','Remove','outline');
  for(const p of products)item.add(new Option(p.name+' · '+cash(p.price),String(p.id)));
  if(id)item.value=String(id);quantity.type='number';quantity.min='1';quantity.max='50';quantity.step='1';quantity.value=String(qty||1);
  remove.type='button';const row={wrap,item,quantity};partRows.push(row);
  remove.onclick=()=>{partRows=partRows.filter(x=>x!==row);wrap.remove();};
  wrap.append(item,quantity,remove);parts.append(wrap);
 };
 addPart.onclick=()=>add();add();
 const start=document.createElement('input');start.type='datetime-local';start.title='Start date (optional)';
 const end=document.createElement('input');end.type='datetime-local';end.title='End date (optional)';
 const active=document.createElement('input');active.type='checkbox';active.checked=true;
 const activeLabel=make('label','Offer active');activeLabel.append(active);
 const specialFields=make('div',undefined,'gw-phase4-field'),bundleFields=make('div',undefined,'gw-offer-bundle-fields');
 specialFields.append(product,percent);bundleFields.append(bundlePrice,parts,addPart);
 const switchType=()=>{specialFields.hidden=type.value!=='special';bundleFields.hidden=type.value!=='bundle';};
 type.onchange=switchType;switchType();
 const save=make('button','Save Offer','primary');save.type='submit';const cancel=make('button','Clear Form','outline');cancel.type='button';
 let editing=null;
 cancel.onclick=()=>{editing=null;form.reset();title.value='';partRows=[];parts.replaceChildren();add();switchType();save.textContent='Save Offer';};
 form.append(title,type,specialFields,bundleFields,make('label','Starts at (optional)'),start,make('label','Ends at (optional)'),end,activeLabel,save,cancel);
 host.append(form,make('h3','Existing Offers'),list);
 const hydrate=o=>{
  editing=o.id;title.value=o.title;type.value=o.offer_type;product.value=o.product_id||'';percent.value=o.percent_off??10;bundlePrice.value=o.bundle_price??0;
  start.value=o.begins_at?new Date(new Date(o.begins_at).getTime()-new Date(o.begins_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  end.value=o.ends_at?new Date(new Date(o.ends_at).getTime()-new Date(o.ends_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  active.checked=o.active;partRows=[];parts.replaceChildren();
  for(const x of Array.isArray(o.items)?o.items:[])add(x);
  if(!partRows.length)add();switchType();save.textContent='Update Offer';form.scrollIntoView({behavior:'smooth',block:'center'});
 };
 const reload=async()=>{
  list.replaceChildren();
  try{
   const rows=await rpc('gw_pos_all_offers');status.textContent=rows.length+' offers configured';
   for(const o of rows){
    const card=make('article',undefined,'gw-feature-card');
    card.append(make('strong',o.title),make('small',(o.offer_type==='special'?o.percent_off+'% off product':'Bundle '+cash(o.bundle_price))+' · '+(o.active?'Active':'Disabled')),
      make('p',(o.begins_at?'Starts '+new Date(o.begins_at).toLocaleString():'No start date')+' · '+(o.ends_at?'Ends '+new Date(o.ends_at).toLocaleString():'No end date')));
    const edit=make('button','Edit Offer','outline');edit.onclick=()=>hydrate(o);card.append(edit);list.append(card);
   }
   if(!rows.length)list.append(make('p','No offers created yet.'));
  }catch(e){status.textContent='Offer manager requires Phase 4 migration and Boss PIN sign-in: '+e.message;}
 };
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;
  try{
   const args={p_id:editing,p_title:title.value.trim(),p_type:type.value,
    p_product:type.value==='special'?product.value:null,p_percent:type.value==='special'?Number(percent.value):null,
    p_items:type.value==='bundle'?partRows.map(x=>({id:x.item.value,qty:Number(x.quantity.value)})):[],
    p_price:type.value==='bundle'?Number(bundlePrice.value):null,
    p_start:start.value?new Date(start.value).toISOString():null,p_end:end.value?new Date(end.value).toISOString():null,p_active:active.checked};
   await rpc('gw_pos_manage_offers',args);status.textContent='Offer saved successfully. Refresh POS to load it.';
   cancel.click();await reload();
  }catch(err){status.textContent='Could not save offer: '+err.message;}finally{save.disabled=false;}
 };
 await reload();
}
export async function showProductAnalytics(host,{call,token,make,cash}){
 host.replaceChildren();
 const head=make('div',undefined,'gw-mdt-head');head.append(make('h2','Product Sales Analytics'),
 make('p','Item-level totals from recorded checkout receipts. Older sales without stored receipt items are not included.'));
 const status=make('p','Loading product performance…'),grid=make('div',undefined,'gw-feature-grid');
 host.append(head,status,grid);
 try{
  const rows=await call('gw_pos_product_analytics',{p_token:token()});
  const totalUnits=rows.reduce((s,r)=>s+Number(r.units),0);
  const cards=make('div',undefined,'gw-mdt-stats');
  for(const [label,value] of [['Items Sold',totalUnits],['Products Tracked',rows.length],['Gross Item Revenue',cash(rows.reduce((s,r)=>s+Number(r.revenue),0))]]){
   const card=make('div',undefined,'gw-mdt-stat');card.append(make('small',label),make('strong',String(value)));cards.append(card);
  }
  host.insertBefore(cards,grid);status.textContent=rows.length+' products with recorded receipt details';
  for(const [i,r] of rows.entries()){
   const card=make('article',undefined,'gw-feature-card');
   card.append(make('strong',(i+1)+'. '+r.product_name),make('p',r.units+' units sold'),make('small',cash(r.revenue)+' gross item value (before discounts)'));grid.append(card);
  }
  if(!rows.length)grid.append(make('p','No itemized sales found yet.'));
 }catch(e){status.textContent='Product analytics requires Phase 4 SQL migration: '+e.message;}
}
