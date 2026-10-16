import {createPhase4} from './phase4-pos.js?v=customer-cid-20261016';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured=!!(SUPABASE_URL&&SUPABASE_ANON_KEY), db=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
// Fallback demo items. Replace with verified live catalog using the admin panel.
const demoProducts=[['Geek Bar (Plain & Flavored)','Geek Bars & Vapes',1000],['Geek Bar (THC)','Geek Bars & Vapes',1100],['Penjamin','Geek Bars & Vapes',500],['Bong','Geek Bars & Vapes',700],['Plain & Flavored Refill','Refills',400],['THC Refill','Refills',500],['Basic Joint','Flower',100],['Basic Blunt','Flower',125],['Premium Joint','Flower',150],['Premium Blunt','Flower',175],['Brownie (6 Pack)','Edibles',250],['Gummies (3 Pack)','Edibles',250],['Slushie','Edibles',250],['Lighter','Accessories & Snacks',13],['Wallet','Accessories & Snacks',650],['Lunch Box','Accessories & Snacks',715],['Green Rolls (8 papers)','Accessories & Snacks',300],['Almond Joy','Accessories & Snacks',25],['Rice Krispies','Accessories & Snacks',30],['Cocoa Powder','Accessories & Snacks',25],['Jolly Ranchers','Accessories & Snacks',25]].map((p,i)=>({id:`demo-${i}`,name:p[0],category:p[1],price:p[2],active:true,ingredients:[]}));
let products=[],zones=[],settings={max_discount:100},cart=JSON.parse(localStorage.getItem('gw-cart')||'{}'),history=JSON.parse(localStorage.getItem('gw-history')||'[]'),category='All',tab='cart',session=null;
const phase4=createPhase4({db,money,getProducts:()=>products,getLines:()=>lines(),
 getToken:()=>sessionStorage.getItem('gw-employee-token')||'',
 onCartChanged:()=>{if(products.length){renderCart();phase4.renderFavorites(chooseProduct);}}});
document.querySelector('#cartView .control')?.before(phase4.root);
const catalogSidebar=document.createElement('div');
catalogSidebar.className='gw-catalog-sidebar';
$('categories').before(catalogSidebar);
catalogSidebar.append($('categories'),phase4.favoritesRoot);
phase4.render();
function saveLocal(){localStorage.setItem('gw-cart',JSON.stringify(cart));localStorage.setItem('gw-history',JSON.stringify(history));}
async function load(){if(!db){products=demoProducts;zones=[{id:'city',name:'City',fee:50},{id:'sandy',name:'Sandy',fee:100},{id:'paleto',name:'Paleto',fee:150}];$('status').textContent='MDT Offline · Demo Mode';render();return;}const [p,z,s]=await Promise.all([db.from('products').select('*').order('sort_order').order('name'),db.from('delivery_zones').select('*').order('sort_order'),db.from('app_settings').select('*').eq('id',1).single()]);if(p.error||z.error||s.error){$('status').textContent='MDT Offline';$('adminMessage').textContent=[p.error?.message,z.error?.message,s.error?.message].filter(Boolean).join(' / ');return;}products=p.data;zones=z.data;settings=s.data;await phase4.refreshOffers();$('status').textContent='● MDT Online';render();}
function productCard(p){const special=phase4.bestSpecial(p.id);return `<article class="product"><div>${p.image_url?`<img class="gw-product-photo" src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="gw-product-placeholder" aria-hidden="true">✦</div>`}<small>${esc(p.category)}</small>${special?`<span class="gw-special-tag">${special}% OFF</span>`:''}<div class="gw-product-name">${esc(p.name)}</div></div><div class="bottom"><span class="price">${money(p.price)}</span><button class="gw-favorite-toggle" type="button" title="Favorite" data-favorite="${esc(p.id)}">${phase4.checkFavorite(p.id)?'★':'☆'}</button><button data-add="${esc(p.id)}">+ ADD</button></div></article>`;}
function render(){const cats=['All',...new Set(products.filter(p=>p.active).map(p=>p.category))];if(!cats.includes(category))category='All';$('categories').innerHTML=cats.map(c=>`<button class="${c===category?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');const q=$('search').value.trim().toLowerCase();const filtered=products.filter(p=>p.active&&(category==='All'||p.category===category)&&p.name.toLowerCase().includes(q));if(category==='All'){const groups=[...new Set(filtered.map(p=>p.category))];$('products').classList.add('gw-products-grouped');$('products').innerHTML=groups.length?groups.map(name=>`<section class="gw-category-section"><div class="gw-category-heading"><h3>${esc(name)}</h3><span>${filtered.filter(p=>p.category===name).length} products</span></div><div class="${name.toLowerCase()==='flower'?'gw-flower-groups':'gw-category-grid'}">${(name.toLowerCase()==='flower'?['Basic','Premium'].map(tier=>{const items=filtered.filter(p=>p.category===name&&(tier==='Basic'?/basic|standard/i.test(p.name):!/basic|standard/i.test(p.name)));return items.length?`<div class="gw-flower-subgroup"><h4>${tier}</h4><div class="gw-category-grid">${items.map(productCard).join('')}</div></div>`:'';}).join(''):filtered.filter(p=>p.category===name).map(productCard).join(''))}</div></section>`).join(''):'<div class="empty">No matching products.</div>';}else{$('products').classList.remove('gw-products-grouped');$('products').innerHTML=filtered.length?filtered.map(productCard).join(''):'<div class="empty">No matching products.</div>';} $('zone').innerHTML=zones.map(z=>`<option value="${esc(z.id)}">${esc(z.name)} — ${money(z.fee)}</option>`).join('');$('discount').max=settings.max_discount??100;if(+$('discount').value>+$('discount').max)$('discount').value=$('discount').max;renderCart();renderIngredients();renderHistory();phase4.renderFavorites(chooseProduct);}

function lines(){return Object.entries(cart).map(([id,qty])=>{const [productId,encoded]=id.split('::');return {id,p:products.find(p=>String(p.id)===productId),choice:encoded?decodeURIComponent(encoded):'',qty};}).filter(x=>x.p&&x.qty>0)}
function totals(){const subtotal=lines().reduce((n,{p,qty})=>n+Number(p.price)*qty,0);const z=zones.find(z=>String(z.id)===$('zone').value);const delivery=document.querySelector('[name=fulfillment]:checked')?.value==='delivery'?Number(z?.fee||0):0;const offerDiscount=phase4.isReady()?phase4.preview().discount:0;const discount=(subtotal-offerDiscount)*Number($('discount').value)/100;const due=Math.max(0,subtotal-offerDiscount-discount+delivery);const rewards=phase4.isReady()?phase4.estimateRedemption(due):0;return{subtotal,delivery,discount,offerDiscount,rewards,total:Math.max(0,due-rewards)}}
function renderCart(){const l=lines();$('count').textContent=`${l.reduce((n,x)=>n+x.qty,0)} ITEMS`;$('cart').innerHTML=l.length?l.map(({p,qty,id,choice})=>`<div class="cartline"><div><b>${esc(p.name)}</b>${choice?`<div class="gw-cart-choice">${esc(choice)}</div>`:''}<div class="meta">${money(p.price)} each · ${money(p.price*qty)}</div></div><div class="qty"><button data-qty="${esc(id)}" data-step="-1">−</button><b>${qty}</b><button data-qty="${esc(id)}" data-step="1">+</button></div></div>`).join(''):'<div class="empty">Your order is empty. Add products from the catalog.</div>';$('zone').hidden=document.querySelector('[name=fulfillment]:checked')?.value!=='delivery';$('discountLabel').textContent=$('discount').value+'%';const t=totals();for(const k of ['subtotal','delivery','discountAmount','total'])$(k).textContent=(k==='discountAmount'?'-':'')+money(t[k==='discountAmount'?'discount':k]);const offersOut=$('gwOfferDiscount'),loyaltyOut=$('gwRewardDiscount');if(offersOut)offersOut.textContent='-'+money(t.offerDiscount);if(loyaltyOut)loyaltyOut.textContent='-'+money(t.rewards);$('checkout').disabled=!l.length;saveLocal();}
function ingredientSummary(){const map=new Map();for(const {p,qty} of lines())for(const item of (Array.isArray(p.ingredients)?p.ingredients:[])){if(!item?.name)continue;const key=`${item.name}|${item.unit||''}`;const v=map.get(key)||{name:item.name,unit:item.unit||'',qty:0};v.qty+=Number(item.qty||0)*qty;map.set(key,v)}return [...map.values()];}
function renderIngredients(){const items=ingredientSummary();$('ingredients').innerHTML=items.length?items.map(x=>`<div class="record">${esc(x.name)} — <b>${x.qty} ${esc(x.unit)}</b></div>`).join(''):'<div class="empty">No ingredient recipes assigned to selected products.</div>';}
let sharedHistory=[],historyLoading=false,historyError='',historyLoaded=false;
function saleLines(s){return Array.isArray(s.line_items)?s.line_items:[];}
function receiptText(s){
 const d=s.created_at?new Date(s.created_at).toLocaleString():'Unknown date';
 const items=saleLines(s);
 const rows=['**Green Wonderland Receipt**','Date/Time: '+d,'Employee: '+(s.employee_name||'Unknown'),'','**Ordered**'];
 if(items.length)for(const x of items)rows.push('• '+x.qty+'x '+x.name+(x.choice?' ('+x.choice+')':'')+' — '+money(x.total));
 else rows.push('• Itemized products unavailable for this older sale');
 rows.push('────────────────────────','• Price: '+money(s.total));
 if(s.store_share!=null)rows.push('• Store (10% of sale): '+money(s.store_share));
 if(s.employee_share!=null)rows.push('• Employee Keeps: '+money(s.employee_share));
 rows.push('• Fulfillment: '+(s.fulfillment||'pickup'));
 if(s.loyalty_meta){const d=s.loyalty_meta;rows.push('• Offers saved: '+money(d.offer_discount),'• Rewards redeemed: '+money(d.reward_discount),'• Loyalty points earned: '+d.points_earned);}
 return rows.join('\n');
}
async function showSaleReceipt(s){
 const dlg=document.createElement('dialog');dlg.className='gw-choice-dialog gw-receipt-dialog gw-paper-receipt';
 const heading=document.createElement('h3');heading.textContent='GREEN WONDERLAND';
 const subtitle=document.createElement('p');subtitle.textContent='SALES RECEIPT';
 const date=document.createElement('p');date.className='gw-paper-date';date.textContent='Date/Time: '+(s.created_at?new Date(s.created_at).toLocaleString():'Unknown');
 const employee=document.createElement('p');employee.className='gw-paper-employee';employee.textContent='Employee: '+(s.employee_name||'Unknown');
 const section=document.createElement('strong');section.className='gw-paper-section';section.textContent='Ordered';
 const itemsHost=document.createElement('div');itemsHost.className='gw-paper-items';
 const note=document.createElement('p');note.className='gw-receipt-note';
 const totalsHost=document.createElement('div');totalsHost.className='gw-paper-totals';
 const actions=document.createElement('div');actions.className='gw-receipt-actions';
 const phase4Summary=document.createElement('div');phase4Summary.className='gw-receipt-phase4';
 const copy=document.createElement('button');copy.type='button';copy.className='primary';copy.textContent='Copy for Discord';
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(receiptText(s));copy.textContent='✓ Copied!';}catch(e){const area=document.createElement('textarea');area.value=receiptText(s);area.readOnly=true;dlg.append(area);area.focus();area.select();copy.textContent='Select and copy receipt text';}};
 const close=document.createElement('button');close.type='button';close.className='outline';close.textContent='Close';close.onclick=()=>dlg.close();
 actions.append(copy,close);dlg.append(heading,subtitle,date,employee,section,itemsHost,note,totalsHost,phase4Summary,actions);
 const draw=()=>{itemsHost.replaceChildren();totalsHost.replaceChildren();const items=saleLines(s);note.textContent=items.length?'':'Itemized products were not saved for this older sale.';for(const x of items){const row=document.createElement('div');row.className='gw-paper-item';const name=document.createElement('span');name.textContent=x.qty+'x '+x.name+(x.choice?' ('+x.choice+')':'');const price=document.createElement('strong');price.textContent=money(x.total);row.append(name,price);itemsHost.append(row);}for(const [label,value] of [['Price',money(s.total)],...(s.store_share!=null?[['Store (10% of sale)',money(s.store_share)]]:[]),...(s.employee_share!=null?[['Employee Keeps',money(s.employee_share)]]:[]),['Fulfillment',s.fulfillment||'pickup']]){const row=document.createElement('div');row.className='gw-paper-total';const name=document.createElement('span');name.textContent=label;const amount=document.createElement('strong');amount.textContent=value;row.append(name,amount);totalsHost.append(row);}};
 draw();dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
 if(db){
  note.textContent='Loading ordered products…';
  try{
   const token=sessionStorage.getItem('gw-employee-token')||'';
   const args={p_token:token,p_sale:s.id==null?null:String(s.id),p_employee_name:s.employee_name||null,p_created_at:s.created_at||null,p_total:Number(s.total||0)};
   const {data,error}=await db.rpc('gw_sale_receipt_items_lookup',args);
   if(error)throw Error(error.message);
   s.line_items=Array.isArray(data)?data:[];
   s.store_share=Number(s.total||0)*.1;
   s.employee_share=Number(s.total||0)*.9;
   draw();
   if(s.id){
    try{
     const {data:meta,error:metaError}=await db.rpc('gw_pos_sale_details',{p_token:token,p_sale:String(s.id)});
     if(!metaError&&meta?.length){
      const d=meta[0];s.loyalty_meta=d;phase4Summary.replaceChildren();
      for(const [label,val] of [['Original subtotal',money(d.base_subtotal)],['Deals saved','−'+money(d.offer_discount)],
        ['Manual discount','−'+money(d.manual_discount)],['Rewards redeemed','−'+money(d.reward_discount)],
        ['Delivery',money(d.delivery_fee)],['Loyalty member',d.member_name||'None'],
        ['Points earned',String(d.points_earned||0)],['Points redeemed',String(d.points_redeemed||0)]]){
       const row=document.createElement('div');row.className='gw-paper-total';
       const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=val;row.append(a,b);phase4Summary.append(row);
      }
     }
    }catch(err){console.warn('Receipt details unavailable:',err);}
   }
   if(!s.line_items.length)note.textContent='No itemized products were recorded for this sale. Sales recorded before the receipt update cannot be reconstructed.';
  }catch(e){
   note.textContent='Could not load product details: '+e.message;
   console.warn('Receipt items unavailable:',e);
  }
 }
}
function renderHistory(){
 if(tab!=='history')return;
 const host=$('history');host.replaceChildren();
 const search=document.createElement('input');search.className='gw-history-filter';search.type='search';search.placeholder='Filter receipts by employee, ID, item or flavor';search.value=window.gwHistoryQuery||'';search.oninput=()=>{window.gwHistoryQuery=search.value;const pos=search.selectionStart;renderHistory();const next=$('history').querySelector('.gw-history-filter');if(next){next.focus();next.setSelectionRange(pos,pos);}};host.append(search);
 if(historyLoading){host.textContent='Loading all recorded sales…';return;}
 if(historyError){host.textContent=historyError;return;}
 if(!sharedHistory.length){host.textContent='No recorded sales found.';return;}
 for(const s of sharedHistory.filter(x=>!window.gwHistoryQuery||[x.employee_name,x.id,x.product_names,x.fulfillment,x.total].some(v=>String(v||'').toLowerCase().includes(window.gwHistoryQuery.toLowerCase())))) {
  const button=document.createElement('button');button.type='button';button.className='record gw-history-sale';
  const top=document.createElement('strong');top.textContent=money(s.total)+' · '+(s.employee_name||'Unknown employee');
  const info=document.createElement('small');info.textContent=(s.created_at?new Date(s.created_at).toLocaleString():'Unknown date')+' · '+Number(s.item_count||0)+' items · '+(s.fulfillment||'');
  const hint=document.createElement('span');hint.className='gw-history-hint';hint.textContent=(s.adjustment_amount>0?'REFUNDED / VOIDED · ':'')+'View receipt ›';
  button.append(top,info,hint);button.onclick=()=>showSaleReceipt(s);host.append(button);
 }
}
async function loadSharedHistory(){
 if(!db){historyError='Shared sales history requires the live database.';renderHistory();return;}
 historyLoading=true;historyError='';renderHistory();
 try{
  const token=sessionStorage.getItem('gw-employee-token')||'';
  const {data,error}=await db.rpc('gw_mdt_sales_history',{p_token:token,p_from:null,p_to:null,p_employee:null});
  if(error)throw Error(error.message);
  sharedHistory=[...(data||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  try{
   const {data:enhanced,error:enhancedError}=await db.rpc('gw_pos_search_sales',{p_token:token,p_query:''});
   if(!enhancedError&&Array.isArray(enhanced)){
    const m=new Map(enhanced.map(x=>[String(x.sale_id),x]));
    sharedHistory=sharedHistory.map(x=>({...x,...(m.get(String(x.id))||{})}));
   }
  }catch(e){console.warn('Advanced receipt search unavailable:',e);}
  historyLoaded=true;
 }catch(e){historyError='Unable to load shared sales history: '+e.message+'. Sign in with an employee PIN that has Sales History access or an administrator account.';}
 finally{historyLoading=false;renderHistory();}
}
$('categories').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(b){category=b.dataset.cat;render();}});$('products').addEventListener('click',e=>{const fav=e.target.closest('[data-favorite]');if(fav){phase4.toggleFavorite(fav.dataset.favorite);render();return;}const b=e.target.closest('[data-add]');if(b){const p=products.find(p=>String(p.id)===b.dataset.add);if(p)chooseProduct(p);}});$('cart').addEventListener('click',e=>{const b=e.target.closest('[data-qty]');if(b){cart[b.dataset.qty]=Math.max(0,(cart[b.dataset.qty]||0)+Number(b.dataset.step));if(!cart[b.dataset.qty])delete cart[b.dataset.qty];renderCart();renderIngredients();}});$('search').addEventListener('input',render);$('discount').addEventListener('input',renderCart);$('zone').addEventListener('change',renderCart);document.querySelectorAll('[name=fulfillment]').forEach(r=>r.addEventListener('change',renderCart));$('clear').onclick=()=>{if(confirm('Clear the current order?')){cart={};$('discount').value=0;renderCart();renderIngredients();}};$('checkout').onclick=async()=>{const l=lines();if(!l.length)return;const t=totals();if(!confirm(`Complete checkout for ${money(t.total)}?`))return;const count=l.reduce((n,x)=>n+x.qty,0),fulfillment=document.querySelector('[name=fulfillment]:checked').value;const button=$('checkout');button.disabled=true;try{if(typeof window.gwRecordSale!=='function')throw Error('Employee system is still loading.');if(phase4.isReady()){
 const selected=window.gwSelectedEmployee?.();
 if(!selected)throw Error('Select or sign in as the employee processing this order.');
 const result=await phase4.checkout({employee:selected,items:l.map(({p,qty,choice})=>({id:String(p.id),qty,choice})),fulfillment,zone:$('zone').value,discount:Number($('discount').value),expectedTotal:t.total});
 if(Math.abs(Number(result.total)-t.total)>0.01)throw Error('Sale recorded with a different total. Please review the sales history.');
}else await window.gwRecordSale({total:t.total,count,fulfillment,items:l.map(({p,qty,choice})=>({name:p.name,qty,choice,unit_price:Number(p.price),total:Number(p.price)*qty}))});history.unshift({date:new Date().toISOString(),total:t.total,count,fulfillment});historyLoaded=false;history=history.slice(0,100);cart={};$('discount').value=0;render();}catch(e){alert('Checkout not recorded: '+e.message);}finally{button.disabled=false;}};$('clearHistory').onclick=()=>{if(confirm('Clear this browser’s order history?')){history=[];renderHistory();saveLocal();}};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));for(const name of ['cart','ingredients','history'])$(name==='cart'?'cartView':name+'View').hidden=name!==tab;if(tab==='history')loadSharedHistory();});$('copyIngredients').onclick=async()=>{await navigator.clipboard.writeText(ingredientSummary().map(x=>`${x.name}: ${x.qty} ${x.unit}`).join('\n'));alert('Ingredients copied.');};$('exportIngredients').onclick=()=>{const rows=[['Ingredient','Quantity','Unit'],...ingredientSummary().map(x=>[x.name,x.qty,x.unit])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='green-wonderland-ingredients.csv';a.click();URL.revokeObjectURL(a.href);};$('themeBtn').onclick=()=>{document.body.classList.toggle('light');$('themeBtn').textContent=document.body.classList.contains('light')?'☾ Lights Off':'☀ Lights On';};
const dialog=$('adminDialog'),msg=s=>$('adminMessage').textContent=s;
const getBossToken=()=>sessionStorage.getItem('gw-employee-token')||'';
$('adminBtn').onclick=async()=>{dialog.showModal();await updateAuthUI();};
$('closeAdmin').onclick=()=>dialog.close();
$('login').onclick=()=>{dialog.close();const control=document.getElementById('gwEmployeeAccess');if(control)control.click();else msg('Employee login is still loading. Try again shortly.');};
$('logout').onclick=async()=>{const t=getBossToken();if(t&&db)await db.rpc('gw_pin_logout',{p_token:t});sessionStorage.removeItem('gw-employee-token');window.dispatchEvent(new Event('gw-employee-session-changed'));await updateAuthUI();};
async function updateAuthUI(){
 if(!db){$('loginPanel').hidden=false;$('adminPanel').hidden=true;msg('Database not configured.');return;}
 const t=getBossToken();
 if(!t){$('loginPanel').hidden=false;$('adminPanel').hidden=true;msg('Sign in to the Employee Time Clock with your Boss PIN to access admin tools.');return;}
 const {data:allowed,error}=await db.rpc('gw_boss_pin_check',{p_token:t});
 const ok=!error&&allowed===true;
 $('loginPanel').hidden=ok;$('adminPanel').hidden=!ok;
 if(!ok){msg('Boss PIN verification required. '+(error?.message||'Your session is not a Boss account.'));return;}
 const {data:staff}=await db.rpc('gw_pin_me',{p_token:t});
 $('adminIdentity').textContent=staff?.[0]?.employee_name||'Boss employee';
 msg('');renderAdmin();
}
window.addEventListener('gw-employee-session-changed',()=>{if(dialog.open)updateAuthUI();});

const defaultChoices=p=>{
 const name=p.name.toLowerCase();
 if(/premium/.test(name)&&/joint|blunt|flower/.test(name))return ['AK-47','Sour Diesel','Blue Dream','Bubble Berry','Trainwreck','OG Kush','Gorilla Glue','Northern Lights'];
 if(/flavored/.test(name)&&/geek bar|refill|vape/.test(name))return ['Strawberry','Mango','Apple','Blueberry','Menthol'];
 return [];
};
function productChoices(p){return Array.isArray(p.options)&&p.options.length?p.options.filter(Boolean):defaultChoices(p);}
function editorList(row,kind,items){
 const box=document.createElement('div');box.className='gw-editor-list';box.dataset.list=kind;
 const title=document.createElement('strong');title.textContent=kind==='ingredients'?'Ingredients':'Customer choices (flavors / strains)';
 const entries=document.createElement('div');entries.className='gw-editor-entries';
 const addItem=(item={})=>{
  const entry=document.createElement('div');entry.className='gw-editor-entry gw-editor-'+kind+'-row';
  const name=document.createElement('input');name.placeholder=kind==='ingredients'?'Ingredient name':'Flavor or strain';name.value=kind==='ingredients'?(item.name||''):(typeof item==='string'?item:'');
  entry.append(name);
  if(kind==='ingredients'){const qty=document.createElement('input');qty.type='number';qty.min='0';qty.step='any';qty.placeholder='Quantity';qty.value=item.qty??1;const unit=document.createElement('input');unit.placeholder='Unit (g, pcs, etc.)';unit.value=item.unit||'';entry.append(qty,unit);}
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.className='gw-editor-remove';remove.onclick=()=>entry.remove();entry.append(remove);entries.append(entry);
 };
 (items||[]).forEach(addItem);
 const add=document.createElement('button');add.type='button';add.textContent=kind==='ingredients'?'+ Add ingredient':'+ Add choice';add.className='gw-editor-add';add.onclick=()=>addItem();
 box.append(title,entries,add);return box;
}
function readEditorList(row,kind){
 const entries=[...row.querySelectorAll('[data-list="'+kind+'"] .gw-editor-entry')];
 return entries.map(entry=>{const fields=entry.querySelectorAll('input');if(kind==='options')return fields[0].value.trim();return {name:fields[0].value.trim(),qty:Number(fields[1].value),unit:fields[2].value.trim()};}).filter(item=>kind==='options'?!!item:!!item.name);
}
function hydrateProductEditors(){
 document.querySelectorAll('#adminProducts .adminrow').forEach(row=>{
  const p=products.find(x=>String(x.id)===row.dataset.id);if(!p)return;
  row.append(editorList(row,'ingredients',Array.isArray(p.ingredients)?p.ingredients:[]),editorList(row,'options',Array.isArray(p.options)?p.options:[]));
 });
}
function addChoiceToCart(p,choice){
 const key=choice?String(p.id)+'::'+encodeURIComponent(choice):String(p.id);
 cart[key]=(cart[key]||0)+1;renderCart();renderIngredients();
}
function chooseProduct(p){
 const options=productChoices(p);
 if(!options.length){addChoiceToCart(p,'');return;}
 const dialog=document.createElement('dialog');dialog.className='gw-choice-dialog';
 const heading=document.createElement('h3');heading.textContent='Choose '+(/premium/i.test(p.name)?'a strain':'a flavor');
 const subtitle=document.createElement('p');subtitle.textContent=p.name+' · '+money(p.price);
 const grid=document.createElement('div');grid.className='gw-choice-grid';
 for(const option of options){const button=document.createElement('button');button.type='button';button.textContent=option;button.onclick=()=>{addChoiceToCart(p,option);dialog.close();dialog.remove();};grid.append(button);}
 const cancel=document.createElement('button');cancel.type='button';cancel.className='outline';cancel.textContent='Cancel';cancel.onclick=()=>{dialog.close();dialog.remove();};
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.append(heading,subtitle,grid,cancel);document.body.append(dialog);dialog.showModal();
}
function adminRow(p,type){if(type==='zone')return `<div class="adminrow zone" data-id="${esc(p.id)}"><input data-field="name" value="${esc(p.name)}" placeholder="Zone"><input data-field="fee" type="number" min="0" value="${p.fee}"><div><button data-save-zone="${esc(p.id)}">Save</button> <button data-delete-zone="${esc(p.id)}">✕</button></div></div>`;return `<div class="adminrow gw-catalog-editor" data-id="${esc(p.id)}"><input data-field="name" value="${esc(p.name)}" placeholder="Name"><input data-field="category" value="${esc(p.category)}" placeholder="Category"><input data-field="price" type="number" min="0" step=".01" value="${p.price}"><label class="gw-active-toggle-field"><span>Active</span><span class="gw-active-switch"><input data-field="active" type="checkbox" role="switch" aria-label="Product active" ${p.active?'checked':''}><span class="gw-active-switch-track"></span></span><span class="gw-active-state">${p.active?'On':'Off'}</span></label><div><button data-save-product="${esc(p.id)}">Save</button> <button data-delete-product="${esc(p.id)}">✕</button></div><label style="grid-column:1/-1">Product image URL<input data-field="image_url" type="url" placeholder="https://example.com/product.png" value="${esc(p.image_url||'')}"></label><div class="gw-admin-image-row"><img src="${esc(p.image_url||'')}" alt="" loading="lazy" ${p.image_url?'':'hidden'}><span>Paste a direct HTTPS image link, then save this product.</span></div></div>`;}
function renderAdmin(){
 const list=$('adminProducts'),filter=document.getElementById('gwAdminProductSearch')?.value.trim().toLowerCase()||'';
 const category=document.getElementById('gwCatalogCategory')?.value||'All Categories';
 const state=document.getElementById('gwCatalogState')?.value||'all';
 const filtered=products.filter(p=>(p.name+' '+p.category).toLowerCase().includes(filter)&&(category==='All Categories'||p.category===category)&&(state==='all'||Boolean(p.active)===(state==='active')));
 list.innerHTML='<div class="gw-catalog-table"><div class="gw-catalog-heading"><span>Product</span><span>Category</span><span>Price</span><span>Status</span><span>Actions</span></div>'+filtered.map(p=>`<div class="gw-catalog-product" data-id="${esc(p.id)}"><div class="gw-catalog-name">${p.image_url?`<img src="${esc(p.image_url)}" alt="" loading="lazy">`:'<span class="gw-catalog-noimage">▣</span>'}<strong>${esc(p.name)}</strong></div><span>${esc(p.category)}</span><strong>${money(p.price)}</strong><span class="${p.active?'gw-active-pill':'gw-inactive-pill'}">${p.active?'Active':'Inactive'}</span><div class="gw-catalog-actions"><button type="button" data-edit-product="${esc(p.id)}" aria-label="Edit ${esc(p.name)}" title="Edit product">✎</button><button type="button" data-delete-product="${esc(p.id)}" aria-label="Delete ${esc(p.name)}" title="Delete product">✕</button></div></div>`).join('')+'</div>';
 $('adminZones').innerHTML=zones.map(z=>adminRow(z,'zone')).join('');$('maxDiscount').value=settings.max_discount;
 const selector=document.getElementById('gwCatalogCategory');
 if(selector){const previous=selector.value;selector.replaceChildren(new Option('All Categories','All Categories'));[...new Set(products.map(p=>p.category))].sort().forEach(cat=>selector.add(new Option(cat,cat)));selector.value=[...selector.options].some(o=>o.value===previous)?previous:'All Categories';}
}
function editCatalogProduct(p){
 const dialog=document.createElement('dialog');dialog.className='gw-catalog-modal';
 dialog.innerHTML='<div class="gw-catalog-modal-head"><h2>Edit Product</h2><button type="button" data-close-editor aria-label="Close">✕</button></div><div class="gw-catalog-modal-body"></div><div class="gw-catalog-modal-actions"><button type="button" data-cancel-editor>Cancel</button><button type="button" class="primary" data-confirm-editor>Save Changes</button></div>';
 const body=dialog.querySelector('.gw-catalog-modal-body');body.innerHTML=adminRow(p,'product');const row=body.querySelector('.adminrow');
 const activeInput=row.querySelector('[data-field="active"]');activeInput.addEventListener('change',()=>{row.querySelector('.gw-active-state').textContent=activeInput.checked?'On':'Off';});
 row.append(editorList(row,'ingredients',Array.isArray(p.ingredients)?p.ingredients:[]),editorList(row,'options',Array.isArray(p.options)?p.options:[]));
 const oldActions=row.querySelector('[data-save-product]')?.parentElement;if(oldActions)oldActions.remove();
 const close=()=>dialog.close();
 dialog.querySelector('[data-close-editor]').onclick=close;dialog.querySelector('[data-cancel-editor]').onclick=close;
 dialog.querySelector('[data-confirm-editor]').onclick=async()=>{
  const button=dialog.querySelector('[data-confirm-editor]');try{
   const v=rowValues(row,['name','category','price','active','image_url']);v.price=Number(v.price);v.image_url=v.image_url.trim()||null;
   if(v.image_url&&!/^https:\/\//i.test(v.image_url))throw Error('Product image must use an HTTPS URL.');
   v.ingredients=readEditorList(row,'ingredients');v.options=readEditorList(row,'options');
   if(v.ingredients.some(x=>!Number.isFinite(x.qty)||x.qty<0)||!v.name.trim()||!v.category.trim()||!Number.isFinite(v.price)||v.price<0)throw Error('Check product fields.');
   button.disabled=true;const saved=await mutate('products','update',v,p.id);if(saved)close();
  }catch(err){msg(err.message);}finally{button.disabled=false;}
 };
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
function rowValues(row,fields){const o={};for(const field of fields){const input=row.querySelector(`[data-field="${field}"]`);o[field]=input.type==='checkbox'?input.checked:input.value;}return o;}
async function mutate(table,method,payload,id){
 if(!db||!getBossToken()){msg('Sign in with your Boss employee PIN first.');return false;}
 msg('Saving...');
 const {data,error}=await db.rpc('gw_boss_catalog_change',{
  p_token:getBossToken(),p_table:table,p_action:method,
  p_id:id==null?null:String(id),p_values:payload||{}
 });
 if(error){msg('Save failed: '+error.message);return false;}
 if(!data){msg('No changes recorded.');return false;}
 await load();
 renderAdmin();msg('Saved in shared catalog.');return true;
}
const catalogTools=document.createElement('div');catalogTools.className='gw-catalog-toolbar';
const catalogSearch=document.createElement('input');catalogSearch.id='gwAdminProductSearch';catalogSearch.type='search';catalogSearch.placeholder='Search products…';
const catalogCategory=document.createElement('select');catalogCategory.id='gwCatalogCategory';catalogCategory.add(new Option('All Categories','All Categories'));
const catalogState=document.createElement('select');catalogState.id='gwCatalogState';for(const [name,value] of [['All Products','all'],['Active Only','active'],['Inactive Only','inactive']])catalogState.add(new Option(name,value));
catalogTools.append(catalogSearch,catalogCategory,catalogState);$('adminProducts').before(catalogTools);
for(const control of [catalogSearch,catalogCategory,catalogState])control.addEventListener(control===catalogSearch?'input':'change',renderAdmin);
$('adminProducts').onclick=async e=>{
 const b=e.target.closest('button');if(!b)return;
 const id=b.dataset.editProduct||b.dataset.deleteProduct,p=products.find(p=>String(p.id)===String(id));if(!p)return;
 if(b.dataset.editProduct){editCatalogProduct(p);return;}
 if(b.dataset.deleteProduct&&confirm('Delete '+p.name+'?'))await mutate('products','delete',null,id);
};
$('adminZones').onclick=async e=>{const b=e.target.closest('button');if(!b)return;const row=b.closest('.adminrow'),id=row.dataset.id;if(b.dataset.deleteZone){if(confirm('Delete this delivery zone?'))await mutate('delivery_zones','delete',null,id);return;}if(b.dataset.saveZone){const v=rowValues(row,['name','fee']);v.fee=Number(v.fee);if(!v.name.trim()||!Number.isFinite(v.fee)||v.fee<0)return msg('Invalid zone.');await mutate('delivery_zones','update',v,id);}};
$('addProduct').onclick=()=>mutate('products','insert',{name:'New product',category:'Other',price:0,active:false,ingredients:[]});$('addZone').onclick=()=>mutate('delivery_zones','insert',{name:'New zone',fee:0});$('saveSettings').onclick=()=>{const n=Number($('maxDiscount').value);if(!Number.isInteger(n)||n<0||n>100)return msg('Discount must be between 0 and 100.');mutate('app_settings','update',{max_discount:n},1);};
if(db){db.channel('catalog-updates').on('postgres_changes',{event:'*',schema:'public',table:'products'},load).on('postgres_changes',{event:'*',schema:'public',table:'delivery_zones'},load).on('postgres_changes',{event:'*',schema:'public',table:'app_settings'},load).subscribe();}
load();
