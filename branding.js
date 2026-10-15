import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const themes={
 wonderland:['#090f0d','#121a16','#1a251e','#344438','#f1f4ed','#a3b0a4','#59c780'],
 midnight:['#0d1525','#142238','#1b2940','#375273','#f6faff','#a8bdd4','#74c7f8'],
 purple:['#171023','#21172f','#2a1c3d','#54406c','#ffffff','#beb0d3','#c7a1ff'],
 light:['#f3f5f4','#ffffff','#edf4ee','#c7d5ca','#1d2c22','#61736b','#20774a'],
 amoled:['#050505','#101010','#171717','#353535','#ffffff','#aaaaaa','#7ee6a0'],
 sunset:['#201510','#291c16','#34231c','#654634','#ffffff','#c8b0a0','#ffb074'],
 emerald:['#061b16','#0c2921','#14382b','#306450','#effff7','#a5c9b7','#3ae2a0'],
 ocean:['#071b25','#102d39','#173d4b','#386276','#f2fbff','#b2cfdd','#43c9e8'],
 crimson:['#200c12','#2c131c','#391b25','#734151','#fff3f5','#d6aeb9','#ff6682'],
 rose:['#24151f','#35202d','#462b3b','#7c516b','#fff4fa','#e1bfd1','#ff94c6'],
 lavender:['#1c1930','#282442','#353054','#635c88','#f9f7ff','#c7c0df','#b9a6ff'],
 gold:['#1c170b','#2b2414','#3b321b','#72603a','#fff9e9','#d7c9a5','#f1c85b'],
 copper:['#24170f','#342219','#442c1e','#805740','#fff5ed','#dbc1ad','#ed995a'],
 arctic:['#eaf3f8','#ffffff','#e1eef5','#b4cbd9','#173443','#536f7f','#147aa3'],
 forest:['#0b170e','#16281a','#223726','#425d46','#f3fff0','#b6cbb1','#9bdf71'],
 slate:['#14191f','#1d252d','#27313a','#4b5c6c','#f3f6f9','#b1c1ce','#88b6db'],
 cyber:['#100c20','#1b1232','#281d45','#584b80','#f7f3ff','#c5b8e5','#00e3c2'],
 cherry:['#fff1f1','#ffffff','#ffe4e8','#e6bdc7','#43232e','#86636e','#c73766'],
 sand:['#f5f0e4','#fffaf0','#eee5d1','#d0c1a2','#342d21','#776e5e','#a56d32'],
 halloween:['#130e18','#211626','#2d1d32','#674362','#fff4e8','#c9b4d0','#ff9238']
};
const labels={wonderland:'Wonderland Dark',midnight:'Midnight Blue',purple:'Royal Purple',light:'Clean Light',amoled:'AMOLED Black',sunset:'Sunset',emerald:'Emerald',ocean:'Deep Ocean',crimson:'Crimson',rose:'Rose',lavender:'Lavender',gold:'Black & Gold',copper:'Copper',arctic:'Arctic Light',forest:'Forest',slate:'Slate',cyber:'Cyber Neon',cherry:'Cherry Blossom',sand:'Warm Sand',halloween:'Halloween'};
const keys=['--bg','--panel','--panel2','--line','--text','--muted','--accent'];
const storeKey='gw-theme-v1';
let branding={},authorized=false,canBrand=false,canProduct=false,boss=false;
function applyTheme(name){const t=themes[name]||themes.wonderland;keys.forEach((key,i)=>document.documentElement.style.setProperty(key,t[i]));document.body.classList.remove('light');document.body.dataset.theme=name;localStorage.setItem(storeKey,name);document.querySelector('#themeBtn')?.setAttribute('aria-label','Open appearance settings');}
function image(url,alt,css){const el=document.createElement('img');el.src=url;el.alt=alt;el.className=css;el.onerror=()=>el.remove();return el;}
function renderLogo(){const el=document.querySelector('.mark');if(!el)return;el.replaceChildren();if(branding.main_logo_url)el.append(image(branding.main_logo_url,'Green Wonderland logo','gw-logo'));else el.textContent='✦';}
async function loadBranding(){const {data,error}=await db.from('gw_branding').select('slot,image_url').eq('active',true);if(!error){branding=Object.fromEntries((data||[]).map(r=>[r.slot+'_url',r.image_url]));renderLogo();}}
const root=document.createElement('dialog');root.id='gwSettings';root.innerHTML=`<div class="dialogHead"><h2>SETTINGS & APPEARANCE</h2><button class="outline" id="gwClose">✕</button></div><h3>Personal theme</h3><div class="gw-theme-grid" id="gwThemes"></div><p>Your theme is saved on this browser.</p><div id="gwBrandingSection" hidden><h3>Branding & Images</h3><p>Only authorized administrators can upload images. Branding updates apply to all visitors.</p><div id="gwBrandingAdmin"></div></div><p id="gwSettingsMessage" role="status"></p>`;
document.body.append(root);
const themeGrid=root.querySelector('#gwThemes');
for(const [name,palette] of Object.entries(themes)){const b=document.createElement('button');b.type='button';b.className='gw-theme-choice';b.innerHTML=`<span class="gw-swatch" style="background:${palette[0]};border-color:${palette[6]}"><i style="background:${palette[6]}"></i></span><span>${labels[name]}</span>`;b.onclick=()=>{applyTheme(name);refreshSelection();};themeGrid.append(b);}
function refreshSelection(){themeGrid.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',Object.keys(themes)[i]===localStorage.getItem(storeKey)));}
applyTheme(localStorage.getItem(storeKey)||'wonderland');refreshSelection();
const trigger=document.createElement('button');trigger.className='outline';trigger.textContent='⚙ Settings';trigger.onclick=async()=>{root.querySelector('#gwBrandingSection').hidden=true;root.showModal();};
window.gwOpenBrandingAdmin=async()=>{root.querySelector('#gwBrandingSection').hidden=false;root.showModal();await refreshAdmin();};
document.querySelector('header .actions')?.append(trigger);
document.querySelector('#themeBtn')?.remove();
root.querySelector('#gwClose').onclick=()=>root.close();
const message=t=>root.querySelector('#gwSettingsMessage').textContent=t;
async function refreshAdmin(){
 const {data:{session}}=await db.auth.getSession();
 const wrap=root.querySelector('#gwBrandingAdmin');wrap.replaceChildren();
 if(!session){authorized=false;wrap.textContent='Sign in through Admin to manage store images.';return;}
 const [b,p,staff]=await Promise.all([db.rpc('gw_can_manage_branding'),db.rpc('gw_can_manage_product_images'),db.rpc('gw_is_boss')]);
 canBrand=b.data===true&&!b.error;canProduct=p.data===true&&!p.error;boss=staff.data===true&&!staff.error;
 authorized=canBrand||canProduct;
 if(!authorized&&!boss){wrap.textContent='Store branding is managed by authorized staff.';return;}
 if(authorized){
 const {data:products}=await db.from('products').select('id,name').order('name');
 const slot=document.createElement('select');
 const options=[...(canBrand?[['main_logo','Main website logo'],['login_logo','Login logo'],['receipt_logo','Receipt logo'],['dashboard_logo','Dashboard logo'],['favicon','Browser icon']]:[]),...(canProduct?[['product','Product image']]:[])];
 for(const [id,label] of options)slot.add(new Option(label,id));
 const product=document.createElement('select');(products||[]).forEach(p=>product.add(new Option(p.name,p.id)));
 const updateVisibility=()=>product.hidden=slot.value!=='product';slot.onchange=updateVisibility;updateVisibility();
 const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';
 const upload=document.createElement('button');upload.className='primary';upload.textContent='Upload / Replace';
 upload.onclick=async()=>{
 const f=file.files?.[0];if(!f)return message('Select an image first.');
 if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>3*1024*1024)return message('Use PNG, JPG or WebP under 3 MB.');
 if(slot.value==='product'&&!product.value)return message('Select a product.');
 if(slot.value==='product'&&!canProduct||slot.value!=='product'&&!canBrand)return message('Not authorized.');
 upload.disabled=true;message('Uploading...');
 try{
 const path=`${slot.value}/${crypto.randomUUID()}.${f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg'}`;
 const {error:upErr}=await db.storage.from('gw-images').upload(path,f,{contentType:f.type,upsert:false});
 if(upErr)throw upErr;
 const url=db.storage.from('gw-images').getPublicUrl(path).data.publicUrl;
 if(slot.value==='product'){
 const {error}=await db.rpc('gw_set_product_image',{p_product_id:product.value,p_image_url:url});if(error)throw error;
 }else{
 const {error}=await db.from('gw_branding').upsert({slot:slot.value,image_url:url,active:true},{onConflict:'slot'});if(error)throw error;
 }
 await loadBranding();message('Image saved. Refresh to see product image changes.');
 }catch(e){message(e.message||String(e));}finally{upload.disabled=false;}
 };
 const reset=document.createElement('button');reset.textContent='Reset selected logo';
 reset.onclick=async()=>{if(slot.value==='product')return message('Select a logo to reset.');if(!canBrand)return;
 if(!confirm('Reset this logo to default?'))return;
 const {error}=await db.from('gw_branding').delete().eq('slot',slot.value);
 if(error)return message(error.message);await loadBranding();message('Logo reset.');};
 const label=document.createElement('label');label.textContent='Image location ';label.append(slot);
 wrap.append(label,product,file,upload);if(canBrand)wrap.append(reset);
 }
 if(boss)await renderStaffManager(wrap);
}
async function renderStaffManager(wrap){
 const heading=document.createElement('h3');heading.textContent='Boss • Staff permissions';wrap.append(heading);
 const {data:staff,error}=await db.from('gw_staff_permissions').select('user_id,display_name,role,can_manage_branding,can_manage_product_images').order('display_name');
 if(error){message(error.message);return;}
 for(const person of staff||[]){
 const row=document.createElement('div');row.className='gw-permission-row';
 const name=document.createElement('strong');name.textContent=person.display_name||person.user_id;
 const role=document.createElement('select');['Boss','Manager','Senior Salesman','Salesman'].forEach(r=>role.add(new Option(r,r)));role.value=person.role;
 const branding=document.createElement('label'),brandCheck=document.createElement('input');brandCheck.type='checkbox';brandCheck.checked=person.can_manage_branding;branding.append(brandCheck,' Logos');
 const images=document.createElement('label'),imageCheck=document.createElement('input');imageCheck.type='checkbox';imageCheck.checked=person.can_manage_product_images;images.append(imageCheck,' Product photos');
 const save=document.createElement('button');save.textContent='Save';
 save.onclick=async()=>{save.disabled=true;const {error}=await db.from('gw_staff_permissions').update({role:role.value,can_manage_branding:brandCheck.checked,can_manage_product_images:imageCheck.checked}).eq('user_id',person.user_id);message(error?error.message:'Permissions saved.');save.disabled=false;};
 row.append(name,role,branding,images,save);wrap.append(row);
 }
 const note=document.createElement('p');note.textContent='New staff accounts must first be linked to their Supabase Auth user ID by an administrator. Keep at least one Boss account.';wrap.append(note);
}
await loadBranding();
db.channel('gw-branding-updates').on('postgres_changes',{event:'*',schema:'public',table:'gw_branding'},loadBranding).subscribe();
