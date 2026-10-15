import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const themes={
 wonderland:['#090f0d','#121a16','#1a251e','#344438','#f1f4ed','#a3b0a4','#b6db72'],
 midnight:['#0d1525','#142238','#1b2940','#375273','#f6faff','#a8bdd4','#74c7f8'],
 purple:['#171023','#21172f','#2a1c3d','#54406c','#ffffff','#beb0d3','#c7a1ff'],
 light:['#f3f5f4','#ffffff','#f0f5f1','#c7d5ca','#1d2c22','#61736b','#20774a'],
 amoled:['#050505','#101010','#171717','#353535','#ffffff','#aaaaaa','#7ee6a0'],
 sunset:['#201510','#291c16','#34231c','#654634','#ffffff','#c8b0a0','#ffb074']
};
const labels={wonderland:'Wonderland Dark',midnight:'Midnight Blue',purple:'Royal Purple',light:'Clean Light',amoled:'AMOLED Black',sunset:'Sunset'};
const keys=['--bg','--panel','--panel2','--line','--text','--muted','--accent'];
const storeKey='gw-theme-v1';
let branding={},authorized=false;
function applyTheme(name){const t=themes[name]||themes.wonderland;keys.forEach((key,i)=>document.documentElement.style.setProperty(key,t[i]));document.body.classList.remove('light');document.body.dataset.theme=name;localStorage.setItem(storeKey,name);document.querySelector('#themeBtn')?.setAttribute('aria-label','Open appearance settings');}
function image(url,alt,css){const el=document.createElement('img');el.src=url;el.alt=alt;el.className=css;el.onerror=()=>el.remove();return el;}
function renderLogo(){const el=document.querySelector('.mark');if(!el)return;el.replaceChildren();if(branding.main_logo_url)el.append(image(branding.main_logo_url,'Green Wonderland logo','gw-logo'));else el.textContent='✦';}
async function loadBranding(){const {data,error}=await db.from('gw_branding').select('slot,image_url').eq('active',true);if(!error){branding=Object.fromEntries((data||[]).map(r=>[r.slot+'_url',r.image_url]));renderLogo();}}
const root=document.createElement('dialog');root.id='gwSettings';root.innerHTML=`<div class="dialogHead"><h2>SETTINGS & APPEARANCE</h2><button class="outline" id="gwClose">✕</button></div><h3>Personal theme</h3><div class="gw-theme-grid" id="gwThemes"></div><p>Your theme is saved on this browser.</p><h3>Branding & Images</h3><p>Only authorized administrators can upload images. Branding updates apply to all visitors.</p><div id="gwBrandingAdmin"></div><p id="gwSettingsMessage" role="status"></p>`;
document.body.append(root);
const themeGrid=root.querySelector('#gwThemes');
for(const [name,palette] of Object.entries(themes)){const b=document.createElement('button');b.type='button';b.className='gw-theme-choice';b.innerHTML=`<span class="gw-swatch" style="background:${palette[0]};border-color:${palette[6]}"><i style="background:${palette[6]}"></i></span><span>${labels[name]}</span>`;b.onclick=()=>{applyTheme(name);refreshSelection();};themeGrid.append(b);}
function refreshSelection(){themeGrid.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',Object.keys(themes)[i]===localStorage.getItem(storeKey)));}
applyTheme(localStorage.getItem(storeKey)||'wonderland');refreshSelection();
const trigger=document.createElement('button');trigger.className='outline';trigger.textContent='⚙ Settings';trigger.onclick=async()=>{root.showModal();await refreshAdmin();};
document.querySelector('header .actions')?.append(trigger);
document.querySelector('#themeBtn')?.remove();
root.querySelector('#gwClose').onclick=()=>root.close();
const message=t=>root.querySelector('#gwSettingsMessage').textContent=t;
async function refreshAdmin(){const {data:{session}}=await db.auth.getSession();if(!session){authorized=false;root.querySelector('#gwBrandingAdmin').textContent='Sign in through Admin to manage images.';return;}const {data,error}=await db.rpc('is_admin');authorized=!error&&data===true;if(!authorized){root.querySelector('#gwBrandingAdmin').textContent='Image management requires administrator access.';return;}
 const {data:products}=await db.from('products').select('id,name').order('name');
 const wrap=root.querySelector('#gwBrandingAdmin');wrap.replaceChildren();
 const slot=document.createElement('select');for(const [id,label] of [['main_logo','Main website logo'],['login_logo','Login logo'],['receipt_logo','Receipt logo'],['dashboard_logo','Dashboard logo'],['favicon','Browser icon'],['product','Product image']]){const o=new Option(label,id);slot.add(o);}
 const product=document.createElement('select');(products||[]).forEach(p=>product.add(new Option(p.name,p.id)));product.hidden=true;slot.onchange=()=>product.hidden=slot.value!=='product';
 const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';const upload=document.createElement('button');upload.className='primary';upload.textContent='Upload / Replace';upload.onclick=async()=>{if(!authorized)return;const f=file.files?.[0];if(!f)return message('Select an image first.');if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>3*1024*1024)return message('Use PNG, JPG or WebP under 3 MB.');if(slot.value==='product'&&!product.value)return message('Select a product.');upload.disabled=true;message('Uploading...');try{const path=`${slot.value}/${crypto.randomUUID()}.${f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg'}`;const {error:upErr}=await db.storage.from('gw-images').upload(path,f,{contentType:f.type,upsert:false});if(upErr)throw upErr;const url=db.storage.from('gw-images').getPublicUrl(path).data.publicUrl;
 if(slot.value==='product'){const {error}=await db.from('products').update({image_url:url}).eq('id',product.value);if(error)throw error;}else{const {error}=await db.from('gw_branding').upsert({slot:slot.value,image_url:url,active:true},{onConflict:'slot'});if(error)throw error;}await loadBranding();message('Image saved. Reload the calculator to see product image changes.');}catch(e){message(e.message||String(e));}finally{upload.disabled=false;}};
 const reset=document.createElement('button');reset.textContent='Reset selected logo';reset.onclick=async()=>{if(slot.value==='product')return message('Select a logo to reset.');if(!confirm('Reset this logo to default?'))return;const {error}=await db.from('gw_branding').delete().eq('slot',slot.value);if(error)return message(error.message);await loadBranding();message('Logo reset.');};
 const label=document.createElement('label');label.textContent='Image location ';label.append(slot);wrap.append(label,product,file,upload,reset);
}
await loadBranding();
db.channel('gw-branding-updates').on('postgres_changes',{event:'*',schema:'public',table:'gw_branding'},loadBranding).subscribe();
