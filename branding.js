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
const customKey='gw-custom-theme-v1';
const effectKey='gw-header-effect-v1';
const effects=[['none','None'],['haze','Floating Haze'],['glow','Moving Glow'],['particles','Floating Particles'],['aurora','Aurora Gradient'],['neon','Neon Sign'],['scan','Digital Scan'],['spotlight','Spotlight Sweep'],['border','Light Trail'],['botanical','Botanical Ambient'],['combo','Haze + Glow'],['pulse','Soft Pulse'],['shimmer','Logo Shimmer'],['waves','Ambient Waves'],['grid','Digital Grid'],['stars','Twinkling Stars'],['breathe','Breathing Accent'],['gradient','Gradient Flow'],['aurora-stars','Aurora + Stars'],['neon-scan','Neon + Scan'],['haze-particles','Haze + Particles'],['glow-trail','Glow + Trail'],['cosmic','Cosmic Drift']];
const validHex=v=>/^#[0-9a-f]{6}$/i.test(v);
function customPalette(){try{const p=JSON.parse(localStorage.getItem(customKey)||'null');return Array.isArray(p)&&p.length===7&&p.every(validHex)?p:null;}catch{return null;}}
function applyHeaderEffect(name){const selected=effects.some(e=>e[0]===name)?name:'none';document.body.dataset.headerEffect=selected;}

let branding={},authorized=false,canBrand=false,canProduct=false,boss=false;
function applyTheme(name){const t=name==='custom'?(customPalette()||themes.wonderland):(themes[name]||themes.wonderland);keys.forEach((key,i)=>document.documentElement.style.setProperty(key,t[i]));document.body.classList.remove('light');document.body.dataset.theme=name;localStorage.setItem(storeKey,name);document.querySelector('#themeBtn')?.setAttribute('aria-label','Open appearance settings');}
function image(url,alt,css){const el=document.createElement('img');el.src=url;el.alt=alt;el.className=css;el.onerror=()=>el.remove();return el;}
function renderFavicon(){const url=branding.favicon_url;let link=document.querySelector('link[data-gw-favicon]');if(!link){link=document.createElement('link');link.rel='icon';link.setAttribute('data-gw-favicon','');document.head.append(link);}if(url){link.type=url.toLowerCase().split('?')[0].endsWith('.png')?'image/png':url.toLowerCase().split('?')[0].endsWith('.webp')?'image/webp':'image/jpeg';link.href=url+(url.includes('?')?'&':'?')+'gwicon='+Date.now();}else{link.type='image/svg+xml';link.href='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#10271b"/><text x="32" y="46" font-size="44" text-anchor="middle" fill="#4cdb8c">✦</text></svg>');}}
function renderLogo(){const el=document.querySelector('.mark');if(!el)return;el.replaceChildren();if(branding.main_logo_url)el.append(image(branding.main_logo_url,'Green Wonderland logo','gw-logo'));else el.textContent='✦';}
async function loadBranding(){const {data,error}=await db.from('gw_branding').select('slot,image_url').eq('active',true);if(!error){branding=Object.fromEntries((data||[]).map(r=>[r.slot+'_url',r.image_url]));renderLogo();renderFavicon();}}
const root=document.createElement('dialog');root.id='gwSettings';root.innerHTML=`<div class="dialogHead"><h2>SETTINGS & APPEARANCE</h2><button class="outline" id="gwClose">✕</button></div><h3>Personal theme</h3><div class="gw-theme-grid" id="gwThemes"></div><p>Your theme is saved on this browser.</p><section class="gw-custom-theme-section"><h3>Build Your Own Theme</h3><p>Customize all seven colors and save your own personal theme. Changes only affect this browser.</p><div class="gw-custom-color-grid" id="gwCustomColors"></div><div class="gw-custom-actions"><button type="button" id="gwCustomPreview" class="outline">Preview Theme</button><button type="button" id="gwCustomSave" class="primary">Save My Theme</button><button type="button" id="gwCustomReset" class="outline">Reset Colors</button></div><p id="gwCustomMessage" role="status"></p></section><section class="gw-header-effects-section"><h3>Header Animation</h3><p>Choose an effect, preview it on the header, then save. Animation colors automatically follow your selected theme.</p><div class="gw-effects-grid" id="gwHeaderEffects"></div><div class="gw-custom-actions gw-effect-actions"><button type="button" class="primary" id="gwEffectSave">Save Header Animation</button><button type="button" class="outline" id="gwEffectCancel">Revert Preview</button></div><p id="gwEffectMessage" role="status"></p></section><section id="gwProfileSection"><h3>My Profile Picture</h3><p>Sign in using your employee PIN, then paste a public HTTPS image URL to display your photo on the Employee Roster.</p><div class="gw-profile-settings"><img id="gwProfilePreview" alt="Your profile picture preview" hidden><input id="gwProfileUrl" type="url" placeholder="https://example.com/my-photo.jpg"><button id="gwProfileSave" class="primary" type="button">Save Profile Picture</button></div><p id="gwProfileMessage" role="status"></p></section><div id="gwBrandingSection" hidden><h3>Branding & Images</h3><p>Only authorized administrators can upload images. Branding updates apply to all visitors.</p><div id="gwBrandingAdmin"></div></div><p id="gwSettingsMessage" role="status"></p>`;
document.body.append(root);
const themeGrid=root.querySelector('#gwThemes');
for(const [name,palette] of Object.entries(themes)){const b=document.createElement('button');b.type='button';b.className='gw-theme-choice';b.innerHTML=`<span class="gw-swatch" style="background:${palette[0]};border-color:${palette[6]}"><i style="background:${palette[6]}"></i></span><span>${labels[name]}</span>`;b.onclick=()=>{applyTheme(name);refreshSelection();};themeGrid.append(b);}
const colorNames=['Background','Panels','Cards','Borders','Text','Muted Text','Accent'];
const customGrid=root.querySelector('#gwCustomColors');
const colors=colorNames.map((label,i)=>{const wrap=document.createElement('label');wrap.className='gw-custom-color';const caption=document.createElement('span');caption.textContent=label;const input=document.createElement('input');input.type='color';input.value=(customPalette()||themes.wonderland)[i];wrap.append(caption,input);customGrid.append(wrap);return input;});
function readColors(){return colors.map(x=>x.value);}
function syncColors(p){colors.forEach((input,i)=>input.value=p[i]);}
const customChoice=document.createElement('button');customChoice.type='button';customChoice.className='gw-theme-choice';customChoice.innerHTML='<span class="gw-swatch gw-custom-swatch"><i></i></span><span>My Custom Theme</span>';
customChoice.onclick=()=>{if(!customPalette()){root.querySelector('#gwCustomMessage').textContent='Choose your colors below and click Save My Theme first.';return;}applyTheme('custom');refreshSelection();};
themeGrid.append(customChoice);
function syncCustomSwatch(){const p=customPalette()||themes.wonderland;customChoice.querySelector('.gw-custom-swatch').style.background=p[0];customChoice.querySelector('.gw-custom-swatch').style.borderColor=p[6];customChoice.querySelector('.gw-custom-swatch i').style.background=p[6];}
root.querySelector('#gwCustomPreview').onclick=()=>{keys.forEach((key,i)=>document.documentElement.style.setProperty(key,readColors()[i]));root.querySelector('#gwCustomMessage').textContent='Preview active. Save to keep it, or select another theme.';};
root.querySelector('#gwCustomSave').onclick=()=>{localStorage.setItem(customKey,JSON.stringify(readColors()));applyTheme('custom');syncCustomSwatch();refreshSelection();root.querySelector('#gwCustomMessage').textContent='Custom theme saved to this browser.';};
root.querySelector('#gwCustomReset').onclick=()=>{syncColors(themes.wonderland);root.querySelector('#gwCustomMessage').textContent='Colors reset to Wonderland defaults. Save to apply.';};
const effectGrid=root.querySelector('#gwHeaderEffects');
for(const [name,label] of effects){const b=document.createElement('button');b.type='button';b.className='gw-effect-choice';b.dataset.effect=name;const preview=document.createElement('span');preview.className='gw-effect-preview';preview.dataset.previewEffect=name;const visual=document.createElement('span');visual.className='gw-effect-preview-visual';const word=document.createElement('span');word.className='gw-effect-preview-word';word.textContent='GW';preview.append(visual,word);const caption=document.createElement('span');caption.className='gw-effect-caption';caption.textContent=label;b.append(preview,caption);b.onclick=()=>{applyHeaderEffect(name);refreshEffects();effectMessage.textContent='Previewing '+label+'. Click Save Header Animation to keep it.';};effectGrid.append(b);}
function refreshEffects(){effectGrid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.effect===document.body.dataset.headerEffect));}
const effectMessage=root.querySelector('#gwEffectMessage');
function savedEffect(){return localStorage.getItem(effectKey)||'none';}
root.querySelector('#gwEffectSave').onclick=()=>{localStorage.setItem(effectKey,document.body.dataset.headerEffect||'none');effectMessage.textContent='Header animation saved on this browser.';refreshEffects();};
root.querySelector('#gwEffectCancel').onclick=()=>{applyHeaderEffect(savedEffect());refreshEffects();effectMessage.textContent='Preview reverted to your saved animation.';};
root.addEventListener('close',()=>{if(document.body.dataset.headerEffect!==savedEffect()){applyHeaderEffect(savedEffect());refreshEffects();}});
applyHeaderEffect(savedEffect());refreshEffects();syncCustomSwatch();
function refreshSelection(){themeGrid.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',(i<Object.keys(themes).length?Object.keys(themes)[i]:'custom')===localStorage.getItem(storeKey)));}
applyTheme(localStorage.getItem(storeKey)||'wonderland');refreshSelection();
const trigger=document.createElement('button');trigger.className='outline';trigger.textContent='⚙ Settings';trigger.onclick=async()=>{root.querySelector('#gwBrandingSection').hidden=true;root.showModal();await refreshProfile();};
window.gwOpenBrandingAdmin=async()=>{root.querySelector('#gwBrandingSection').hidden=false;root.showModal();await refreshAdmin();};
document.querySelector('header .actions')?.append(trigger);
document.querySelector('#themeBtn')?.remove();
root.querySelector('#gwClose').onclick=()=>root.close();
async function refreshProfile(){
 const status=root.querySelector('#gwProfileMessage'),input=root.querySelector('#gwProfileUrl'),preview=root.querySelector('#gwProfilePreview');
 const token=sessionStorage.getItem('gw-employee-token')||'';
 input.disabled=!token;root.querySelector('#gwProfileSave').disabled=!token;
 if(!token){status.textContent='Sign in with your employee PIN to edit your roster picture.';preview.hidden=true;return;}
 try{const {data,error}=await db.rpc('gw_my_profile_picture',{p_token:token});if(error)throw error;input.value=data||'';preview.src=input.value;preview.hidden=!input.value;status.textContent='';}
 catch(e){status.textContent='Profile picture setup required: '+e.message;}
}
root.querySelector('#gwProfileSave').onclick=async()=>{
 const token=sessionStorage.getItem('gw-employee-token')||'',input=root.querySelector('#gwProfileUrl'),status=root.querySelector('#gwProfileMessage');
 const url=input.value.trim();if(url&&!/^https:\/\//i.test(url)){status.textContent='Please enter a public HTTPS image URL.';return;}
 const button=root.querySelector('#gwProfileSave');button.disabled=true;
 try{const {error}=await db.rpc('gw_update_my_profile_picture',{p_token:token,p_url:url||null});if(error)throw error;status.textContent='Profile picture saved. Refresh the roster to see it.';await refreshProfile();}
 catch(e){status.textContent='Unable to save picture: '+e.message;}
 finally{button.disabled=false;}
};
root.querySelector('#gwProfileUrl').addEventListener('input',()=>{const image=root.querySelector('#gwProfilePreview'),url=root.querySelector('#gwProfileUrl').value.trim();image.hidden=!/^https:\/\//i.test(url);if(!image.hidden)image.src=url;});

const message=t=>root.querySelector('#gwSettingsMessage').textContent=t;
async function refreshAdmin(){
 const wrap=root.querySelector('#gwBrandingAdmin');wrap.replaceChildren();
 const token=sessionStorage.getItem('gw-employee-token')||'';
 if(!token){authorized=false;wrap.textContent='Sign in with your Boss employee PIN to manage store images.';return;}
 const {data:allowed,error}=await db.rpc('gw_boss_pin_check',{p_token:token});
 boss=allowed===true&&!error;canBrand=boss;canProduct=boss;authorized=boss;
 if(!boss){wrap.textContent='Boss employee PIN session required to manage store images.';return;}
 const {data:products,error:productsError}=await db.from('products').select('id,name').order('name');
 if(productsError){wrap.textContent=productsError.message;return;}
 const slot=document.createElement('select');
 for(const [id,label] of [['main_logo','Main website logo'],['login_logo','Login logo'],['receipt_logo','Receipt logo'],
 ['dashboard_logo','Dashboard logo'],['favicon','Browser icon'],['product','Product image']])slot.add(new Option(label,id));
 const product=document.createElement('select');
 for(const p of products||[])product.add(new Option(p.name,p.id));
 const input=document.createElement('input');input.type='url';input.placeholder='https://example.com/image.png';
 input.setAttribute('aria-label','Direct HTTPS image URL');
 const hint=document.createElement('p');
 hint.textContent='Upload a PNG, JPG or WebP (up to 3 MB), or paste an HTTPS image URL. Uploads use Boss PIN verification on a secure Supabase function.';
 const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';
 file.setAttribute('aria-label','Choose an image to upload');file.className='gw-admin-image-file';
 const upload=document.createElement('button');upload.className='primary';upload.textContent='Upload Image';
 upload.type='button';
 upload.onclick=async()=>{
  const picked=file.files?.[0];
  if(!picked)return message('Choose an image file to upload.');
  if(picked.size===0||picked.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(picked.type))
   return message('Select a PNG, JPG or WebP image under 3 MB.');
  upload.disabled=true;message('Uploading securely…');
  const form=new FormData();form.append('slot',slot.value);form.append('product',slot.value==='product'?product.value:'');form.append('file',picked);
  try{
   const {data,error:e}=await db.functions.invoke('boss-image-upload',{
    body:form,headers:{'x-gw-employee-token':token}
   });
   if(e||!data?.ok)throw Error(data?.error||e?.message||'Upload was not accepted');
   await loadBranding();
   input.value=data.url;file.value='';
   message('Image uploaded and saved. '+(slot.value==='favicon'?'Refresh the page to update the browser tab.':''));
  }catch(e){message('Upload failed: '+e.message+'. Verify the boss-image-upload Edge Function is deployed.');}
  finally{upload.disabled=false;}
 };
 const updateVisibility=()=>product.hidden=slot.value!=='product';
 slot.onchange=updateVisibility;updateVisibility();
 const save=document.createElement('button');save.className='primary';save.textContent='Save Image URL';
 const reset=document.createElement('button');reset.className='outline';reset.textContent='Reset Selected Image';
 const apply=async url=>{
  if(url&&!/^https:\/\//i.test(url))return message('Enter an HTTPS image URL.');
  save.disabled=true;reset.disabled=true;
  try{
   const {error:e}=await db.rpc('gw_boss_set_image_url',{p_token:token,p_slot:slot.value,
     p_product:slot.value==='product'?String(product.value):null,p_url:url||null});
   if(e)throw e;
   await loadBranding();
   message(url?'Image URL saved. Refresh to see your change.':'Image reset successfully.');
  }catch(e){message('Unable to save image: '+e.message);}finally{save.disabled=false;reset.disabled=false;}
 };
 save.onclick=()=>apply(input.value.trim());
 reset.onclick=()=>{if(confirm('Reset the selected image?'))apply(null);};
 const label=document.createElement('label');label.textContent='Image location ';label.append(slot);
 wrap.append(label,product,file,upload,hint,input,save,reset);
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
