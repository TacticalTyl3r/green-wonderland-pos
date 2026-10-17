// Green Wonderland POS: dedicated, checkout-safe shopping for active offers.
// A bundle adds its real catalog components; the existing server checkout
// applies the matching fixed-price savings once. No fake "bundle product" is sold.
export function createPosDeals({
 catalog, catalogSidebar, productHost, searchInput, getProducts, getOffers,
 offersReady, productChoices, chooseProduct, addBundleLines, money, refreshOffers
}){
 const el=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=String(text);
  return node;
 };
 const heading=catalog.querySelector('.section-head h2');
 const eyebrow=catalog.querySelector('.section-head small');
 const nav=el('div','gw-pos-shop-switch');
 nav.setAttribute('role','group');
 nav.setAttribute('aria-label','POS shopping section');
 const productTab=el('button','active','▦  Products');
 const dealsTab=el('button','','✦  Bundles & Deals');
 productTab.type=dealsTab.type='button';
 productTab.setAttribute('aria-pressed','true');
 dealsTab.setAttribute('aria-pressed','false');
 nav.append(productTab,dealsTab);
 catalogSidebar.before(nav);
 const panel=el('section','gw-pos-deals-panel');
 panel.id='gwPosDealsPanel';
 const tool=el('div','gw-pos-deals-toolbar');
 const search=el('input');
 search.type='search';search.placeholder='Search bundles and deals…';
 search.setAttribute('aria-label','Search bundles and deals');
 const refresh=el('button','outline','↻ Refresh Deals');refresh.type='button';
 const status=el('p','gw-pos-deals-status');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const groups=el('div','gw-pos-deals-groups');
 tool.append(search,refresh);panel.append(tool,status,groups);
 productHost.after(panel);
 let current='products';
 const titleFor=o=>String(o.title||'Untitled offer');
 const validParts=o=>{
  return (Array.isArray(o.items)?o.items:[]).map(item=>{
   const p=getProducts().find(p=>String(p.id)===String(item.id)&&p.active);
   const qty=Number(item.qty)||1;
   return {p,qty};
  });
 };
 const extrasFor=o=>Array.isArray(o.custom_items)?o.custom_items:[];
 const grossFor=parts=>parts.reduce((sum,x)=>sum+(x.p?Number(x.p.price)*x.qty:0),0);
 const addButton=(name,handler,disabled=false)=>{
  const button=el('button','primary',name);button.type='button';button.disabled=disabled;button.onclick=handler;return button;
 };
 const productName=(part)=>part.p?part.p.name:'Unavailable product';
 const setTab=target=>{
  current=target;
  const active=target==='deals';
  catalog.classList.toggle('gw-show-deals',active);
  nav.querySelectorAll('button').forEach((btn,i)=>{
   const selected=(i===1)===active;
   btn.classList.toggle('active',selected);
   btn.setAttribute('aria-pressed',String(selected));
  });
  catalogSidebar.hidden=active;
  productHost.hidden=active;
  panel.hidden=!active;
  searchInput.hidden=active;
  heading.textContent=active?'BUNDLES & DEALS':'THE CATALOG';
  eyebrow.textContent=active?'01 / CURRENT OFFERS':'01 / PRODUCT SELECTION';
  if(active)render();
 };
 productTab.onclick=()=>setTab('products');
 dealsTab.onclick=()=>setTab('deals');
 const openBundle=o=>{
  const parts=validParts(o);
  if(!parts.length||parts.some(x=>!x.p||!Number.isInteger(x.qty)||x.qty<1||x.qty>50)){
   status.textContent='This bundle has missing or invalid catalog products. Ask a manager to edit it.';return;
  }
  const dialog=el('dialog','gw-pos-deal-modal');
  const head=el('div','gw-pos-deal-modal-head');
  const title=el('h2','',titleFor(o));
  const close=el('button','outline','✕');close.type='button';close.setAttribute('aria-label','Close bundle');close.onclick=()=>dialog.close();
  head.append(title,close);
  const body=el('div','gw-pos-deal-modal-body');
  const pricing=el('p','gw-pos-deal-modal-price');
  pricing.textContent='Bundle price: '+money(Number(o.bundle_price))+' · Regular catalog value: '+money(grossFor(parts));
  const help=el('p','gw-pos-deal-modal-help','Choose the flavor or strain for each included item, then add the complete bundle. Different bundle offers should be checked out separately to preserve each advertised bundle price.');
  body.append(pricing,help);
  const selection=[];
  for(const part of parts){
   const block=el('div','gw-pos-deal-modal-item');
   block.append(el('strong','',part.qty+'× '+part.p.name));
   const options=productChoices(part.p);
   if(options.length){
    const choices=el('div','gw-pos-deal-choice-grid');
    for(let i=0;i<part.qty;i++){
     const label=el('label','gw-pos-deal-choice');
     label.append(el('span','',part.qty===1?'Flavor / strain':'Item '+(i+1)+' flavor / strain'));
     const select=el('select');
     select.add(new Option('Select an option…',''));
     for(const option of options)select.add(new Option(option,option));
     select.required=true;label.append(select);choices.append(label);
     selection.push({p:part.p,select,qty:1});
    }
    block.append(choices);
   }else{
    block.append(el('small','','No options needed'));
    selection.push({p:part.p,choice:'',qty:part.qty});
   }
   body.append(block);
  }
  if(extrasFor(o).length){
   const extras=el('div','gw-pos-deal-extras');
   extras.append(el('strong','','Extras to include with this bundle'));
   for(const item of extrasFor(o)){
    extras.append(el('span','',(Number(item.qty)||1)+'× '+String(item.name||'Extra item')));
   }
   extras.append(el('small','','These are fulfillment reminders; custom extras are not separate checkout products or receipt lines.'));
   body.append(extras);
  }
  const error=el('p','gw-pos-deal-modal-error');error.setAttribute('role','alert');body.append(error);
  const actions=el('div','gw-pos-deal-modal-actions');
  const cancel=el('button','outline','Cancel');cancel.type='button';cancel.onclick=()=>dialog.close();
  const add=addButton('Add Bundle to Order',()=>{
   if(selection.some(x=>x.select&&!x.select.value)){
    error.textContent='Please select a flavor or strain for every required item.';return;
   }
   const items=selection.map(x=>({p:x.p,choice:x.select?x.select.value:x.choice,qty:x.qty}));
   addBundleLines(items);
   dialog.close();
   setTab('deals');
   status.textContent=titleFor(o)+' added to the current order. Eligible savings are calculated automatically in Current Order.';
  });
  actions.append(cancel,add);
  dialog.append(head,body,actions);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);dialog.showModal();
 };
 const bundleCard=o=>{
  const parts=validParts(o);
  const missing=!parts.length||parts.some(x=>!x.p||!Number.isInteger(x.qty)||x.qty<1||x.qty>50);
  const gross=grossFor(parts);
  const price=Number(o.bundle_price);
  const savings=Math.max(0,gross-price);
  const card=el('article','gw-pos-deal-card');
  const meta=el('div','gw-pos-deal-card-top');
  meta.append(el('span','gw-pos-deal-kind','FIXED PRICE BUNDLE'));
  if(savings>0)meta.append(el('span','gw-pos-deal-save','SAVE '+money(savings)));
  card.append(meta,el('h3','',titleFor(o)));
  const items=el('div','gw-pos-deal-inclusions');
  for(const part of parts)items.append(el('span','',(part.qty||1)+'× '+productName(part)));
  for(const extra of extrasFor(o))items.append(el('span','gw-pos-deal-extra','+ '+(Number(extra.qty)||1)+'× '+String(extra.name||'Extra item')+' (included extra)'));
  card.append(items);
  const footer=el('div','gw-pos-deal-card-footer');
  const priceBlock=el('div','gw-pos-deal-prices');
  priceBlock.append(el('strong','',money(price)));
  if(gross>price)priceBlock.append(el('s','',money(gross)));
  footer.append(priceBlock,addButton('Add Bundle',()=>openBundle(o),missing));
  card.append(footer);
  if(missing)card.append(el('small','gw-pos-deal-unavailable','Unavailable: one or more catalog items are inactive or missing.'));
  return card;
 };
 const openSpecialQuantity=(offer,product,qty)=>{
  if(qty===1){chooseProduct(product);return;}
  const options=productChoices(product);
  if(!options.length){
   addBundleLines([{p:product,choice:'',qty}]);
   status.textContent=qty+'× '+product.name+' added. Discount appears after the required quantity is reached.';
   return;
  }
  const dialog=el('dialog','gw-pos-deal-modal');
  const head=el('div','gw-pos-deal-modal-head');
  const title=el('h2','',titleFor(offer));const close=el('button','outline','✕');close.type='button';
  close.onclick=()=>dialog.close();head.append(title,close);
  const body=el('div','gw-pos-deal-modal-body');
  body.append(el('p','gw-pos-deal-modal-price',qty+'× '+product.name+' · '+Number(offer.percent_off)+'% off when the required quantity is in the order'));
  const choices=el('div','gw-pos-deal-choice-grid');
  const fields=[];
  for(let i=0;i<qty;i++){
   const label=el('label','gw-pos-deal-choice');
   label.append(el('span','','Item '+(i+1)+' flavor / strain'));
   const select=el('select');select.add(new Option('Select an option…',''));
   for(const option of options)select.add(new Option(option,option));
   label.append(select);choices.append(label);fields.push(select);
  }
  body.append(choices);
  const error=el('p','gw-pos-deal-modal-error');body.append(error);
  const actions=el('div','gw-pos-deal-modal-actions');
  const cancel=el('button','outline','Cancel');cancel.type='button';cancel.onclick=()=>dialog.close();
  const add=addButton('Add '+qty+' to Order',()=>{
   if(fields.some(field=>!field.value)){error.textContent='Choose a flavor or strain for each item.';return;}
   addBundleLines(fields.map(field=>({p:product,choice:field.value,qty:1})));
   dialog.close();
   status.textContent=qty+'× '+product.name+' added to the current order.';
  });
  actions.append(cancel,add);dialog.append(head,body,actions);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);dialog.showModal();
 };
 const specialCard=o=>{
  const specs=Array.isArray(o.items)&&o.items.length?o.items:[{id:o.product_id,qty:1}];
  const selected=specs.map(item=>({
   p:getProducts().find(p=>String(p.id)===String(item.id)&&p.active),
   qty:Number(item.qty)||1
  })).filter(x=>x.p);
  const card=el('article','gw-pos-deal-card');
  const meta=el('div','gw-pos-deal-card-top');
  meta.append(el('span','gw-pos-deal-kind','PRODUCT SPECIAL'),el('span','gw-pos-deal-save',Number(o.percent_off)+'% OFF'));
  card.append(meta,el('h3','',titleFor(o)));
  const list=el('div','gw-pos-deal-inclusions');
  for(const x of selected)list.append(el('span','',x.qty+'× '+x.p.name));
  card.append(list);
  const note=el('small','gw-pos-deal-special-note','Buy the listed quantity of an eligible product to receive the percentage discount on complete groups.');
  card.append(note);
  const chooser=el('div','gw-pos-deal-special-choice');
  const select=el('select');select.setAttribute('aria-label','Select discounted product for '+titleFor(o));
  if(!selected.length)select.add(new Option('No eligible products available',''));
  else for(const x of selected)select.add(new Option(x.qty+'× '+x.p.name+' · '+money(x.p.price*x.qty*(1-Number(o.percent_off)/100)),String(x.p.id)));
  const add=addButton('+ Add Special',()=>{
   const selectedProduct=selected.find(x=>String(x.p.id)===select.value);
   if(selectedProduct)openSpecialQuantity(o,selectedProduct.p,selectedProduct.qty);
  },!selected.length);
  chooser.append(select,add);card.append(chooser);
  return card;
 };
 const render=()=>{
  groups.replaceChildren();
  if(!offersReady()){
   status.textContent='Live deals are not available. Refresh the POS to retry.';return;
  }
  const offers=getOffers();
  const q=search.value.trim().toLowerCase();
  const matching=offers.filter(o=>{
   const parts=validParts(o).map(x=>productName(x)).join(' ');
   return (titleFor(o)+' '+parts).toLowerCase().includes(q);
  });
  status.textContent=offers.length+' active offer'+(offers.length===1?'':'s')+' · Discounts are calculated in Current Order. Ring up different bundles separately; only the highest savings path applies per checkout.';
  if(!matching.length){
   groups.append(el('p','gw-pos-deals-empty',offers.length?'No deals match your search.':'No active offers yet. A manager can create them in Bundles & Specials.'));
   return;
  }
  for(const [type,name] of [['bundle','BUNDLES'],['special','PRODUCT SPECIALS']]){
   const items=matching.filter(o=>o.offer_type===type);
   if(!items.length)continue;
   const section=el('section','gw-pos-deals-section');
   const top=el('div','gw-pos-deals-section-title');
   top.append(el('h3','',name),el('span','',String(items.length)+' available'));
   const grid=el('div','gw-pos-deals-grid');
   for(const o of items)grid.append(type==='bundle'?bundleCard(o):specialCard(o));
   section.append(top,grid);groups.append(section);
  }
 };
 search.oninput=render;
 refresh.onclick=async()=>{
  refresh.disabled=true;refresh.textContent='Refreshing…';
  try{await refreshOffers();render();}
  catch(e){status.textContent='Unable to refresh deals: '+e.message;}
  finally{refresh.disabled=false;refresh.textContent='↻ Refresh Deals';}
 };
 setTab('products');
 return {render,setTab};
}
