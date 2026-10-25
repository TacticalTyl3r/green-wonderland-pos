// Boss-managed offers and item-based sales insights for Green Wonderland.
// Offers Manager V2: product-style searchable table + modal create/edit workflow.
// Custom offer entries are descriptive extras, never independently priced products.
// Checkout discount math remains tied to catalog items and authoritative prices.
export async function showOffersManager(host,{call,token,make,cash}){
 host.replaceChildren();
 const rpc=(name,args={})=>call(name,{p_token:token(),...args});
 const top=make('div',undefined,'gw-mdt-head gw-offer-manager-top');
 const copy=make('div');
 copy.append(make('h2','Bundles & Specials'),
  make('p','Create and manage product discounts, bundle prices, and custom included items.'));
 const create=make('button','+ New Offer','primary');create.type='button';
 top.append(copy,create);
 const status=make('p','Loading offers…','gw-offer-manager-status');
 status.setAttribute('role','status');
 const summary=make('div',undefined,'gw-offer-summary');
 const toolbar=make('div',undefined,'gw-offer-toolbar');
 const search=document.createElement('input');
 search.type='search';search.placeholder='Search offers, products or custom items';
 search.setAttribute('aria-label','Search offers');
 const kind=document.createElement('select');kind.setAttribute('aria-label','Filter offers by type');
 for(const [text,value] of [['All Offer Types','all'],['Product Specials','special'],['Product Bundles','bundle']])kind.add(new Option(text,value));
 const visibility=document.createElement('select');visibility.setAttribute('aria-label','Filter offers by status');
 for(const [text,value] of [['All Statuses','all'],['Active','active'],['Inactive','inactive']])visibility.add(new Option(text,value));
 toolbar.append(search,kind,visibility);
 const list=make('div',undefined,'gw-offer-list');
 host.append(top,status,summary,toolbar,list);
 let products=[],offers=[];
 const byId=new Map();
 try{
  const config=await import('./config.js');
  const mod=await import('https://esm.sh/@supabase/supabase-js@2');
  const client=mod.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY);
  const {data,error}=await client.from('products').select('id,name,price,active').order('name');
  if(error)throw Error(error.message);
  products=(data||[]).filter(p=>p.active);
  for(const p of data||[])byId.set(String(p.id),p);
 }catch(e){status.textContent='Unable to load product catalog: '+e.message;create.disabled=true;return;}
 const dateLabel=date=>date?new Date(date).toLocaleString():'No limit';
 const inWindow=o=>{
  const now=Date.now();
  return Boolean(o.active)&&(!o.begins_at||new Date(o.begins_at).getTime()<=now)&&(!o.ends_at||new Date(o.ends_at).getTime()>now);
 };
 const offerStatus=o=>{
  if(!o.active)return ['Inactive','inactive'];
  if(o.begins_at&&new Date(o.begins_at).getTime()>Date.now())return ['Scheduled','scheduled'];
  if(o.ends_at&&new Date(o.ends_at).getTime()<=Date.now())return ['Expired','expired'];
  return ['Active','active'];
 };
 const includedNames=o=>{
  if(o.offer_type==='special'){
   const items=Array.isArray(o.items)&&o.items.length?o.items:[{id:o.product_id,qty:1}];
   const extras=Array.isArray(o.custom_items)?o.custom_items:[];
   return [...items.map(item=>(Number(item.qty)||1)+'× '+(byId.get(String(item.id))?.name||'Catalog product')),
    ...extras.map(item=>(Number(item.qty)||1)+'× '+String(item.name||'Custom extra')+' (extra)')].join(' · ');
  }
  const parts=(Array.isArray(o.items)?o.items:[]).map(x=>(Number(x.qty)||1)+'× '+(byId.get(String(x.id))?.name||'Catalog item'));
  const custom=(Array.isArray(o.custom_items)?o.custom_items:[]).map(x=>(Number(x.qty)||1)+'× '+String(x.name||'Custom item'));
  return [...parts,...custom].join(' · ')||'No items';
 };
 const toLocal=s=>{
  if(!s)return '';
  const date=new Date(s);
  if(Number.isNaN(date.getTime()))return '';
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
 };
 const tinyButton=(caption,className,handler,label)=>{
  const b=make('button',caption,className);
  b.type='button';if(label)b.setAttribute('aria-label',label);
  b.onclick=handler;return b;
 };
 const renderList=()=>{
  summary.replaceChildren();
  for(const [label,value] of [['Total Offers',offers.length],['Live Now',offers.filter(inWindow).length],
   ['Scheduled',offers.filter(o=>offerStatus(o)[1]==='scheduled').length]]){
   const card=make('div',undefined,'gw-offer-summary-card');
   card.append(make('small',label),make('strong',String(value)));summary.append(card);
  }
  const query=search.value.trim().toLowerCase();
  const rows=offers.filter(o=>(kind.value==='all'||o.offer_type===kind.value)&&
   (visibility.value==='all'||(visibility.value==='active'?Boolean(o.active):!o.active))&&
   (!query||(o.title+' '+includedNames(o)).toLowerCase().includes(query)));
  list.replaceChildren();
  const table=make('div',undefined,'gw-offer-table');
  const header=make('div',undefined,'gw-offer-table-heading');
  for(const name of ['Offer','Type','Price / Discount','Status','Actions'])header.append(make('span',name));
  table.append(header);
  for(const o of rows){
   const row=make('div',undefined,'gw-offer-table-row');
   const description=make('div',undefined,'gw-offer-identity');
   const icon=make('span',o.offer_type==='bundle'?'▦':'%','gw-offer-icon');
   const details=make('div',undefined,'gw-offer-identity-copy');
   details.append(make('strong',o.title),make('small',includedNames(o)));
   const dates=make('small',
    'Starts: '+dateLabel(o.begins_at)+'  ·  Ends: '+dateLabel(o.ends_at),
    'gw-offer-dates');
   details.append(dates);description.append(icon,details);
   const type=make('span',o.offer_type==='bundle'?'Bundle':'Special','gw-offer-type');
   const price=make('strong',o.offer_type==='bundle'?cash(o.bundle_price):Number(o.percent_off)+'% off','gw-offer-price');
   const [label,state]=offerStatus(o);const badge=make('span',label,'gw-offer-state '+state);
   const actions=make('div',undefined,'gw-offer-row-actions');
   const edit=tinyButton('✎','outline',()=>openEditor(o),'Edit '+o.title);
   edit.title='Edit offer';
   const remove=tinyButton('✕','outline',async()=>{
    if(!window.confirm('Permanently delete the offer "'+o.title+'"? This cannot be undone.'))return;
    remove.disabled=true;
    try{await rpc('gw_pos_delete_offer',{p_id:o.id});status.textContent='Offer deleted.';await reload();}
    catch(e){status.textContent='Unable to delete offer: '+e.message;remove.disabled=false;}
   },'Delete '+o.title);
   remove.title='Delete offer';
   actions.append(edit,remove);
   row.append(description,type,price,badge,actions);table.append(row);
  }
  list.append(table);
  if(!rows.length){
   const empty=make('div',undefined,'gw-offer-empty');
   empty.append(make('strong',offers.length?'No matching offers':'No offers created yet'),
    make('p',offers.length?'Try another search or filter.':'Create your first bundle or product special to get started.'));
   if(!offers.length)empty.append(tinyButton('+ Create Offer','primary',()=>openEditor(),'Create a new offer'));
   list.append(empty);
  }
 };
 search.oninput=renderList;kind.onchange=renderList;visibility.onchange=renderList;
 const reload=async()=>{
  try{
   const rows=await rpc('gw_pos_all_offers');
   offers=Array.isArray(rows)?rows:[];
   status.textContent=offers.length+' offer'+(offers.length===1?'':'s')+' configured';
   renderList();
  }catch(e){
   status.textContent='Unable to load offers: '+e.message;
  }
 };
 const openEditor=(existing=null)=>{
  const dialog=document.createElement('dialog');dialog.className='gw-offer-editor-dialog';
  const head=make('div',undefined,'gw-offer-modal-head');
  head.append(make('h2',existing?'Edit Offer':'Create Offer'));
  const x=tinyButton('✕','outline',()=>dialog.close(),'Close offer editor');head.append(x);
  const form=document.createElement('form');form.className='gw-offer-editor-form';
  form.noValidate=true;
  const field=(label,control,help)=>{
   const wrap=make('label',undefined,'gw-offer-field');
   const name=make('span',label);wrap.append(name,control);
   if(help)wrap.append(make('small',help));return wrap;
  };
  const title=document.createElement('input');title.type='text';title.maxLength=100;title.required=true;
  title.placeholder='e.g. Starter Pack (Plain)';title.value=existing?.title||'';
  const type=document.createElement('select');
  type.add(new Option('Product Bundle','bundle'));type.add(new Option('Product Special','special'));
  type.value=existing?.offer_type||'bundle';
  const special=make('section',undefined,'gw-offer-type-fields');
  const specialParts=make('div',undefined,'gw-offer-item-rows');
  let specialRows=[];
  const addSpecialProduct=(value={})=>{
   const wrap=make('div',undefined,'gw-offer-item-row gw-offer-special-item-row');
   const selector=document.createElement('select');selector.setAttribute('aria-label','Discounted product or custom extra');
   for(const p of products)selector.add(new Option(p.name+' · '+cash(p.price),String(p.id)));
   selector.add(new Option('✎ Custom Item — enter your own','__custom__'));
   const input=document.createElement('input');input.type='text';input.maxLength=120;
   input.placeholder='Type your custom item name';input.setAttribute('aria-label','Custom item name');
   if(value.custom||value.name!=null){selector.value='__custom__';input.value=String(value.name||'');}
   else if(value.id!=null)selector.value=String(value.id);
   const quantity=document.createElement('input');
   quantity.type='number';quantity.min='1';quantity.max='50';quantity.step='1';
   quantity.value=String(value.qty??1);
   quantity.setAttribute('aria-label','Product or extra quantity');
   const qtyField=make('label',undefined,'gw-offer-special-quantity');
   qtyField.append(make('span','Qty'),quantity);
   const toggle=()=>{
    input.hidden=selector.value!=='__custom__';
    input.required=!input.hidden;
    wrap.classList.toggle('is-custom',!input.hidden);
   };
   selector.onchange=toggle;toggle();
   const remove=tinyButton('Remove','outline',()=>{
    if(specialRows.length<=1)return;
    specialRows=specialRows.filter(r=>r.wrap!==wrap);wrap.remove();
   },'Remove discounted product or custom extra');
   wrap.append(selector,input,qtyField,remove);specialParts.append(wrap);
   specialRows.push({wrap,selector,input,quantity});
  };
  const selectedSpecials=existing?.offer_type==='special'&&Array.isArray(existing.items)&&existing.items.length
   ?existing.items:[{id:existing?.offer_type==='special'?existing.product_id:null,qty:1}];
  const selectedExtras=existing?.offer_type==='special'&&Array.isArray(existing.custom_items)?existing.custom_items:[];
  for(const item of selectedSpecials)addSpecialProduct(item);
  for(const item of selectedExtras)addSpecialProduct({...item,custom:true});
  // Specials remain one discounted catalog product. Checkout's server-side
  // pricing currently applies one special by product_id, not multiple product
  // groups or minimum-quantity thresholds.
  const addSpecial=tinyButton('+ Add Product','outline',()=>{
   if(specialRows.some(r=>r.selector.value!=='__custom__'))return;
   const next=products[0];
   if(next)addSpecialProduct({id:next.id,qty:1});
  },'Add the discounted catalog product');
  const addCustomSpecial=tinyButton('+ Add Custom Item','outline',()=>{
   if(specialRows.filter(r=>r.selector.value==='__custom__').length>=15)return;
   addSpecialProduct({custom:true,qty:1});
  },'Add a descriptive custom extra');
  const specialActions=make('div',undefined,'gw-offer-add-actions');
  specialActions.append(addSpecial,addCustomSpecial);
  const percent=document.createElement('input');
  percent.type='number';percent.min='0.01';percent.max='100';percent.step='0.01';
  percent.value=String(existing?.percent_off??10);
  const specialCustomNote=make('small','Special discounts apply to one catalog product. Custom names are descriptive inclusions, not POS items or additional discounts. Bundle offers can include multiple catalog products.','gw-offer-custom-note');
  special.append(field('Discounted Products',specialParts,'Select catalog products or Custom Item. Set a quantity from 1 to 50 for each entry.'),specialActions,specialCustomNote,
   field('Percent Off',percent,'A percentage from 0.01 to 100; catalog discounts apply to complete quantity groups.'));
  const bundle=make('section',undefined,'gw-offer-type-fields');
  const bundlePrice=document.createElement('input');bundlePrice.type='number';
  bundlePrice.min='0';bundlePrice.step='0.01';bundlePrice.placeholder='e.g. 1100';
  bundlePrice.value=existing?.bundle_price!=null?String(existing.bundle_price):'';
  const parts=make('div',undefined,'gw-offer-item-rows');
  let partRows=[];
  const addPart=(value={})=>{
   const wrap=make('div',undefined,'gw-offer-item-row');
   const selector=document.createElement('select');selector.setAttribute('aria-label','Bundle item');
   for(const p of products)selector.add(new Option(p.name+' · '+cash(p.price),String(p.id)));
   selector.add(new Option('✎ Custom Item — enter your own','__custom__'));
   const input=document.createElement('input');input.type='text';input.maxLength=120;
   input.placeholder='Type any item name';input.setAttribute('aria-label','Custom item name');
   const quantity=document.createElement('input');quantity.type='number';quantity.min='1';
   quantity.max='50';quantity.step='1';quantity.value=String(value.qty||1);
   quantity.setAttribute('aria-label','Bundle item quantity');
   if(value.name){selector.value='__custom__';input.value=String(value.name);}
   else if(value.id!=null)selector.value=String(value.id);
   const toggle=()=>{input.hidden=selector.value!=='__custom__';input.required=!input.hidden;wrap.classList.toggle('is-custom',!input.hidden);};
   selector.onchange=toggle;toggle();
   const remove=tinyButton('Remove','outline',()=>{partRows=partRows.filter(v=>v.wrap!==wrap);wrap.remove();},'Remove bundle item');
   wrap.append(selector,input,quantity,remove);parts.append(wrap);
   partRows.push({wrap,selector,input,quantity});
  };
  const existingParts=Array.isArray(existing?.items)?existing.items:[];
  const customParts=Array.isArray(existing?.custom_items)?existing.custom_items:[];
  for(const item of existingParts)addPart(item);
  for(const item of customParts)addPart(item);
  if(!existingParts.length&&!customParts.length)addPart();
  const add=tinyButton('+ Add Bundle Item','outline',()=>addPart(),'Add another bundle item');
  const bonusNote=make('small','Custom items are included extras (e.g. gift bag or bonus item). They do not become checkout catalog products. At least one catalog item is required for automatic bundle pricing.','gw-offer-custom-note');
  bundle.append(field('Bundle Price',bundlePrice,'Set the final price for one full bundle.'),
   make('h3','Items Included'),parts,add,bonusNote);
  const switchType=()=>{special.hidden=type.value!=='special';bundle.hidden=type.value!=='bundle';};
  type.onchange=switchType;switchType();
  const timing=make('div',undefined,'gw-offer-time-fields');
  const start=document.createElement('input');start.type='datetime-local';start.value=toLocal(existing?.begins_at);
  const end=document.createElement('input');end.type='datetime-local';end.value=toLocal(existing?.ends_at);
  timing.append(field('Starts At (Optional)',start),field('Ends At (Optional)',end));
  const active=document.createElement('input');active.type='checkbox';active.checked=existing?Boolean(existing.active):true;
  const toggle=make('label',undefined,'gw-offer-active-field');
  toggle.append(active,make('span','Offer active'));
  const message=make('p','','gw-offer-editor-message');message.setAttribute('role','status');
  const buttons=make('div',undefined,'gw-offer-modal-actions');
  const cancel=tinyButton('Cancel','outline',()=>dialog.close());
  const save=make('button',existing?'Save Changes':'Create Offer','primary');save.type='submit';
  buttons.append(cancel,save);
  form.append(field('Offer Name',title),field('Offer Type',type),special,bundle,timing,toggle,message,buttons);
  dialog.append(head,form);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);dialog.showModal();
  title.focus();
  form.onsubmit=async event=>{
   event.preventDefault();
   try{
    const name=title.value.trim();
    if(name.length<3||name.length>100)throw Error('Offer name must be between 3 and 100 characters.');
    let lines=[],extras=[];
    if(type.value==='bundle'){
     if(!partRows.length)throw Error('Add at least one bundle item.');
     for(const row of partRows){
      const qty=Number(row.quantity.value);
      if(!Number.isInteger(qty)||qty<1||qty>50)throw Error('Every bundle item needs a quantity from 1 to 50.');
      if(row.selector.value==='__custom__'){
       const customName=row.input.value.trim();
       if(!customName||customName.length>120)throw Error('Enter a custom item name (1 to 120 characters).');
       extras.push({name:customName,qty});
      }else{
       if(!row.selector.value)throw Error('Select a product or choose Custom Item.');
       lines.push({id:row.selector.value,qty});
      }
     }
     if(!lines.length)throw Error('Add at least one catalog product. Custom inclusions are added as extras.');
     if(lines.length>15||extras.length>15)throw Error('Bundles can include at most 15 catalog items and 15 custom extras.');
     if(!Number.isFinite(Number(bundlePrice.value))||bundlePrice.value.trim()===''||Number(bundlePrice.value)<0)
      throw Error('Enter a valid bundle price.');
    }else{
     const rate=Number(percent.value);
     for(const row of specialRows){
      const qty=Number(row.quantity.value);
      if(!Number.isInteger(qty)||qty<1||qty>50)
       throw Error('Every discounted product and custom item needs a quantity from 1 to 50.');
      if(row.selector.value==='__custom__'){
       const customName=row.input.value.trim();
       if(!customName||customName.length>120)throw Error('Enter a custom item name (1 to 120 characters).');
       extras.push({name:customName,qty});
      }else{
       if(!row.selector.value)throw Error('Select a catalog product or Custom Item.');
       lines.push({id:row.selector.value,qty});
      }
     }
     if(lines.length!==1)throw Error('A Product Special discounts one catalog product. Use Product Bundle for multiple products.');
     if(lines[0].qty!==1)throw Error('Product Specials currently apply to each unit; leave its quantity at 1.');
     if(extras.length>15)throw Error('Use at most 15 custom extras.');
     if(!Number.isFinite(rate)||rate<=0||rate>100)throw Error('Enter a valid discount percentage.');
    }
    if(start.value&&end.value&&new Date(end.value)<=new Date(start.value))
     throw Error('The ending date must be after the starting date.');
    save.disabled=true;save.textContent='Saving…';message.textContent='';
    const args={
     p_id:existing?.id??null,p_title:name,p_type:type.value,
     p_product:type.value==='special'?lines[0].id:null,
     p_percent:type.value==='special'?Number(percent.value):null,
     p_items:lines,
     p_custom_items:extras,
     p_price:type.value==='bundle'?Number(bundlePrice.value):null,
     p_start:start.value?new Date(start.value).toISOString():null,
     p_end:end.value?new Date(end.value).toISOString():null,
     p_active:active.checked
    };
    await rpc('gw_pos_manage_offers_v2',args);
    dialog.close();status.textContent='Offer saved successfully. Refresh the POS to update checkout offers.';
    await reload();
   }catch(error){message.textContent='Could not save: '+error.message;save.disabled=false;save.textContent=existing?'Save Changes':'Create Offer';}
  };
 };
 create.onclick=()=>openEditor();
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
