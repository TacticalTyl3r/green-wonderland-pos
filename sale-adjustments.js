// Sale adjustments use secured database RPCs; original sales are retained.
export async function showSaleAdjustments(host,{call,token,canFeature,cash,make}){
 host.replaceChildren();
 const head=make('div',undefined,'gw-mdt-head');
 head.append(make('h2','Refunds & Voided Sales'),make('p','Review and correct transactions with a permanent adjustment history. Original sale records are preserved.'));
 host.append(head);
 const status=make('p','Loading recent sales…');
 const search=document.createElement('input');search.type='search';search.placeholder='Search employee name or sale ID';search.className='gw-mgmt-search';
 const list=make('div',undefined,'gw-feature-grid'),journal=make('div',undefined,'gw-mdt-roster');
 host.append(search,status,list,make('h3','Adjustment History'),journal);
 const rpc=(name,args={})=>call(name,{p_token:token(),...args});
 const canAdjust=canFeature('sales_adjust');
 const render=async()=>{
  status.textContent='Loading sales…';list.replaceChildren();journal.replaceChildren();
  try{
   const sales=await rpc('gw_mdt_adjustable_sales',{p_search:search.value.trim()});
   status.textContent=sales.length+' recent sales · Adjustments are recorded separately from the original sale totals.';
   for(const sale of sales){
    const card=make('article',undefined,'gw-feature-card');
    card.append(make('strong',cash(sale.total)+' · '+sale.employee_name),
     make('small',new Date(sale.created_at).toLocaleString()+' · Sale '+sale.sale_id),
     make('p','Previously adjusted: '+cash(sale.adjusted)+' · Remaining: '+cash(sale.remaining)));
    if(canAdjust&&Number(sale.remaining)>0){
     const button=make('button','Refund / Void','outline');card.append(button);
     button.onclick=()=>{
      card.querySelector('form')?.remove();
      const form=make('form',undefined,'gw-mdt-form');
      const type=document.createElement('select');
      type.add(new Option('Partial / Full Refund','refund'));type.add(new Option('Void Remaining Balance','void'));
      const amount=document.createElement('input');amount.type='number';amount.min='0.01';amount.step='0.01';amount.max=String(sale.remaining);
      amount.value=Number(sale.remaining).toFixed(2);amount.required=true;
      const reason=document.createElement('textarea');reason.placeholder='Required reason for the adjustment (5+ characters)';reason.required=true;reason.minLength=5;reason.maxLength=1000;
      const save=make('button','Confirm Adjustment','primary'),cancel=make('button','Cancel','outline');
      cancel.type='button';cancel.onclick=()=>form.remove();
      type.onchange=()=>{if(type.value==='void'){amount.value=Number(sale.remaining).toFixed(2);amount.readOnly=true;}else amount.readOnly=false;};
      form.append(type,amount,reason,save,cancel);
      form.onsubmit=async e=>{e.preventDefault();if(!confirm('Record this '+type.value+' for '+cash(Number(amount.value))+'? The adjustment will be permanent.'))return;
       save.disabled=true;
       try{await rpc('gw_mdt_adjust_sale',{p_sale:sale.sale_id,p_type:type.value,p_amount:Number(amount.value),p_reason:reason.value.trim()});await render();}
       catch(err){status.textContent='Adjustment failed: '+err.message;save.disabled=false;}
      };
      card.append(form);
     };
    }
    list.append(card);
   }
   if(!sales.length)list.append(make('p','No matching sales.'));
   const changes=await rpc('gw_mdt_sale_adjustments_list');
   journal.classList.add('gw-adjustment-history');
   for(const a of changes){
    const isVoid=a.adjustment_type==='void';
    const row=make('article',undefined,'gw-adjustment-card');
    row.classList.add(isVoid?'gw-adjustment-void':'gw-adjustment-refund');
    const top=make('div',undefined,'gw-adjustment-top');
    const action=make('span',isVoid?'✕  VOIDED SALE':'↩  REFUND ISSUED','gw-adjustment-tag');
    const amount=make('strong',(isVoid?'−':'+')+cash(a.amount),'gw-adjustment-amount');
    top.append(action,amount);
    const reasonBox=make('div',undefined,'gw-adjustment-reason');
    reasonBox.append(make('span','REASON','gw-adjustment-field-label'),make('p',a.reason||'No reason provided'));
    const fields=make('div',undefined,'gw-adjustment-fields');
    const field=(label,value,extraClass)=>{
     const group=make('div',undefined,'gw-adjustment-field');
     group.append(make('span',label,'gw-adjustment-field-label'),make('span',value,'gw-adjustment-field-value'+(extraClass?' '+extraClass:'')));
     fields.append(group);
    };
    field('PERFORMED BY',a.performed_by||'Unknown','gw-adjustment-actor');
    field('DATE & TIME',new Date(a.created_at).toLocaleString());
    field('SALE ID',a.sale_id||'Unknown','gw-adjustment-sale-id');
    row.append(top,reasonBox,fields);journal.append(row);
   }
   if(!changes.length)journal.append(make('p','No adjustments recorded yet.'));
  }catch(err){status.textContent='This feature requires the Phase 2 Supabase SQL migration. '+err.message;}
 };
 let wait;search.oninput=()=>{clearTimeout(wait);wait=setTimeout(render,300);};
 await render();
}
