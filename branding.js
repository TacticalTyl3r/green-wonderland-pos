import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const themes={
 wonderland:['#09140e','#14241a','#1d3224','#3a5744','#f3fbf4','#accab6','#71dc97'],
 emerald:['#071a16','#102c25','#193d32','#35634f','#f2fff8','#a9d4bf','#42e5a9'],
 forest:['#0b190f','#182a1b','#243d27','#486549','#f1f8ec','#a9c5a7','#ade17a'],
 lime:['#10190d','#1c2815','#29371e','#58713a','#f6ffe9','#c1d2a5','#bdff50'],
 mint:['#e9f8f1','#fbfffd','#d9eee3','#a9d0bb','#193b2b','#527563','#1e8454'],
 sage:['#f4f3e9','#fffdf5','#e7e9d9','#c4cfba','#25392b','#657766','#326d4b'],
 purple:['#160e25','#26163e','#362454','#654585','#fbf5ff','#c9b8dd','#c59afa'],
 cyber:['#0a1022','#161b36','#232848','#515588','#f3f7ff','#b7bedb','#36e8ec'],
 gold:['#13120e','#242016','#332c1e','#706041','#fff9e8','#d9c8a2','#f4c45a'],
 sunset:['#221319','#331e25','#462934','#804759','#fff5f1','#dfb4bd','#ff9875'],
 cherry:['#fff0f5','#fffdfd','#ffe1eb','#e7bacb','#482639','#8a596e','#bc3f70'],
 ocean:['#081c27','#102d3a','#194353','#3c6a7c','#eefbff','#b2cfdd','#54d6f1'],
 halloween:['#180e1f','#28172e','#38203d','#6d426d','#fff2e6','#d7b7d8','#ff9851'],
 light:['#f4f7f4','#ffffff','#eaf2ec','#c5d6c9','#1d3227','#5b7565','#267e51'],
 amoled:['#040806','#0d100e','#171d19','#303c34','#f5faf5','#aab9ac','#71f3a3'],
 midnight:['#0b1425','#132139','#1c2e4b','#3c587c','#f3f8ff','#acbfdc','#75beff'],
 arctic:['#e8f3fc','#ffffff','#deebf6','#aecbdc','#17384a','#547789','#167ba3'],
 sand:['#f6f0e4','#fffaf1','#eae0cd','#cfbb9d','#3a2b1c','#796751','#98672d'],
 radioactive:['#0d1108','#1c2513','#28371a','#596c3b','#f7ffe9','#c0d4a3','#b4ff3c'],
 orchid:['#110a21','#23143a','#321e50','#604382','#faf4ff','#c6b7d9','#da76ff'],
 pinkriot:['#190e1e','#2b1835','#3b2547','#714976','#fff4fc','#dbb8d9','#ff61cf'],
 cobalt:['#071427','#102744','#18395e','#426890','#eef6ff','#afcae9','#58afff'],
 tropical:['#071c23','#10333a','#19464a','#3b6c69','#f0fffc','#a7d9d0','#ff9c70'],
 volcano:['#1b1114','#301c20','#452831','#83504c','#fff7ed','#dac2b5','#ff684f'],
 candy:['#fff0f9','#fffaff','#f8ddec','#e1b7ce','#432440','#855e7d','#ab2786'],
 citrus:['#fff6e1','#fffcf1','#f6e7c5','#ddc593','#3e321b','#776a45','#a34b12'],
 sky:['#e8f4ff','#fcfeff','#dcecff','#b4d0e6','#15334c','#5e7d95','#146dbe'],
 lagoon:['#e6fbf5','#f9fffc','#d5f1e8','#a8d5c9','#123e3a','#50736d','#087b6b']
};
const labels={
 wonderland:'Wonderland Signature',emerald:'Emerald Luxe',forest:'Forest Canopy',
 lime:'Electric Kush',mint:'Mint Ice',sage:'Sage & Cream',
 purple:'Purple Haze',cyber:'Neon Arcade',gold:'Black & Gold',
 sunset:'Sunset Punch',cherry:'Cherry Blossom',ocean:'Aqua Depths',halloween:'Halloween Nights',
 light:'Clean Light',amoled:'AMOLED Black',midnight:'Midnight Blue',arctic:'Arctic Light',sand:'Warm Sand',
 radioactive:'Radioactive Lime',orchid:'Laser Orchid',pinkriot:'Pink Riot',cobalt:'Electric Cobalt',tropical:'Tropical Voltage',volcano:'Volcanic Neon',candy:'Cotton Candy',citrus:'Citrus Splash',sky:'Skyline Blue',lagoon:'Lagoon Glow'
};
const themeGroups=[
 {name:'🌿 GREEN WONDERLAND',description:'Signature greens, leafy tones, and fresh botanical colors.',
  choices:[['wonderland','Dark'],['emerald','Dark'],['forest','Dark'],['lime','Dark'],['mint','Light'],['sage','Light']]},
 {name:'⚡ BOLD & COLORFUL',description:'Vivid palettes with colorful highlights that really pop.',
  choices:[['purple','Dark'],['cyber','Dark'],['gold','Dark'],['sunset','Dark'],['cherry','Light'],['ocean','Dark'],['halloween','Dark']]},
 {name:'🔥 EXTRA POP',description:'Bold neons, candy colors and electric combinations made to stand out.',
  choices:[['radioactive','Dark'],['orchid','Dark'],['pinkriot','Dark'],['cobalt','Dark'],['tropical','Dark'],['volcano','Dark'],['candy','Light'],['citrus','Light'],['sky','Light'],['lagoon','Light']]},
 {name:'◐ LIGHT & DARK',description:'Clean daytime looks and understated nighttime alternatives.',
  choices:[['light','Light'],['amoled','Dark'],['midnight','Dark'],['arctic','Light'],['sand','Light']]}
];
// Old saved themes continue working by selecting their closest current palette.
const retiredThemeAliases={crimson:'sunset',rose:'cherry',lavender:'purple',copper:'sunset',slate:'midnight'};
function activeThemeName(name){
 const chosen=retiredThemeAliases[name]||name;
 return chosen==='custom'||Object.prototype.hasOwnProperty.call(themes,chosen)?chosen:'wonderland';
}
const keys=['--bg','--panel','--panel2','--line','--text','--muted','--accent'];
const storeKey='gw-theme-v1';
const customKey='gw-custom-theme-v1';
const effectKey='gw-header-effect-v1';
const effectGroups=[
 {title:'Static',description:'A clean header with no movement.',options:[['none','None','No animation']]},
 {title:'🌿 Cannabis-Inspired',description:'Smoke, cannabis leaves, and bold Green Wonderland character.',options:[
  ['kush-smoke','Kush Smoke','Smooth clouds of drifting smoke'],
  ['neon-leaf','Neon Cannabis Leaf','A glowing leaf with a bright pulse'],
  ['floating-leaves','Floating Cannabis Leaves','Cannabis leaves drifting upward'],
  ['four-twenty','420 After Dark','A flickering green neon 420 sign'],
  ['psychedelic','Psychedelic High','Colorful, swirling psychedelic light'],
  ['cannabis-spotlight','Cannabis Spotlight','Moving spotlight with a leaf silhouette']
 ]},
 {title:'⚡ High-Energy',description:'Bright lighting and lively modern effects.',options:[
  ['electric-lime','Electric Lime','Electric green energy streaks'],
  ['rainbow-prism','Rainbow Prism','Full-spectrum rotating color'],
  ['laser-show','Laser Show','Sweeping nightclub-style laser beams'],
  ['holographic','Holographic Shift','Shifting iridescent light'],
  ['spark-burst','Spark Burst','Bright drifting sparks'],
  ['cyber-glitch','Cyber Glitch','Glitching digital scan lines']
 ]},
 {title:'🎉 Holiday & Seasonal',description:'Seasonal options you can switch on whenever you like.',options:[
  ['holiday-halloween','Halloween Haunt','Orange-purple glow, pumpkins and bats'],
  ['holiday-snow','Winter Snowfall','Falling snowflakes and icy blue light'],
  ['holiday-lights','Festive Lights','Twinkling multicolor holiday lights'],
  ['holiday-hearts','Valentine Hearts','Floating pink and red hearts']
 ]}
];
const effects=effectGroups.flatMap(group=>group.options);
const motionKey='gw-header-reduced-motion-v1';
const buttonOpacityKey='gw-header-button-fill-v1';
const validHex=v=>/^#[0-9a-f]{6}$/i.test(v);
function customPalette(){try{const p=JSON.parse(localStorage.getItem(customKey)||'null');return Array.isArray(p)&&p.length===7&&p.every(validHex)?p:null;}catch{return null;}}
function applyHeaderEffect(name){const selected=effects.some(e=>e[0]===name)?name:'none';document.body.dataset.headerEffect=selected;}

let branding={},authorized=false,canBrand=false,canProduct=false,boss=false;
function applyTheme(name){const selected=activeThemeName(name);const t=selected==='custom'?(customPalette()||themes.wonderland):themes[selected];keys.forEach((key,i)=>document.documentElement.style.setProperty(key,t[i]));document.body.classList.remove('light');document.body.dataset.theme=selected;localStorage.setItem(storeKey,selected);document.querySelector('#themeBtn')?.setAttribute('aria-label','Open appearance settings');}
function image(url,alt,css){const el=document.createElement('img');el.src=url;el.alt=alt;el.className=css;el.onerror=()=>el.remove();return el;}
function renderFavicon(){const url=branding.favicon_url;let link=document.querySelector('link[data-gw-favicon]');if(!link){link=document.createElement('link');link.rel='icon';link.setAttribute('data-gw-favicon','');document.head.append(link);}if(url){link.type=url.toLowerCase().split('?')[0].endsWith('.png')?'image/png':url.toLowerCase().split('?')[0].endsWith('.webp')?'image/webp':'image/jpeg';link.href=url+(url.includes('?')?'&':'?')+'gwicon='+Date.now();}else{link.type='image/svg+xml';link.href='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#10271b"/><text x="32" y="46" font-size="44" text-anchor="middle" fill="#4cdb8c">✦</text></svg>');}}
function renderLogo(){const el=document.querySelector('.mark');if(!el)return;el.replaceChildren();if(branding.main_logo_url)el.append(image(branding.main_logo_url,'Green Wonderland logo','gw-logo'));else el.textContent='✦';}
async function loadBranding(){const {data,error}=await db.from('gw_branding').select('slot,image_url').eq('active',true);if(!error){branding=Object.fromEntries((data||[]).map(r=>[r.slot+'_url',r.image_url]));renderLogo();renderFavicon();}}
const root=document.createElement('dialog');root.id='gwSettings';root.innerHTML=`<div class="dialogHead"><h2>SETTINGS & APPEARANCE</h2><button class="outline" id="gwClose">✕</button></div><section class="gw-themes-section"><div class="gw-themes-intro"><div><h3>Personal Theme</h3><p>Choose a palette that suits your style. Each theme updates the POS, MDT, menus, and buttons.</p></div><span class="gw-themes-count">28 themes</span></div><div id="gwThemes" class="gw-theme-catalog"></div><p class="gw-theme-save-hint">Click any theme to apply it immediately. Your choice is saved on this browser.</p></section><section class="gw-custom-theme-section"><h3>Build Your Own Theme</h3><p>Customize all seven colors and save your own personal theme. Changes only affect this browser.</p><div class="gw-custom-color-grid" id="gwCustomColors"></div><div class="gw-custom-actions"><button type="button" id="gwCustomPreview" class="outline">Preview Theme</button><button type="button" id="gwCustomSave" class="primary">Save My Theme</button><button type="button" id="gwCustomReset" class="outline">Reset Colors</button></div><p id="gwCustomMessage" role="status"></p></section><section class="gw-header-buttons-section"><h3>Header Button Appearance</h3><p>Adjust the background transparency of the header buttons to reveal more of your selected animation. Button text remains fully readable.</p><div class="gw-header-opacity-head"><label for="gwButtonOpacity">Button Background Opacity</label><strong id="gwButtonOpacityValue">100%</strong></div><input id="gwButtonOpacity" type="range" min="0" max="100" step="5" value="100" aria-label="Header button background opacity"><div class="gw-header-opacity-preview" aria-hidden="true"><span class="gw-header-opacity-example">Admin Tools</span><span class="gw-header-opacity-example">Clock In</span><span class="gw-header-opacity-example">Settings</span></div><div class="gw-custom-actions gw-effect-actions"><button id="gwButtonOpacitySave" type="button" class="primary">Save Button Opacity</button><button id="gwButtonOpacityRevert" type="button" class="outline">Revert Preview</button></div><p id="gwButtonOpacityMessage" role="status"></p></section><section class="gw-header-effects-section"><div class="gw-effect-intro"><div><h3>Header Animations</h3><p>Pick an effect to preview it in the sample header and on the site. Save to keep it on this browser.</p></div><span class="gw-effect-total">17 choices</span></div><div class="gw-effect-live-preview" id="gwEffectLivePreview" data-preview-effect="none"><span class="gw-effect-live-logo">✦</span><span class="gw-effect-live-text"><strong>GREEN WONDERLAND</strong><small id="gwEffectPreviewName">No animation</small></span><span class="gw-effect-live-tag">POS / MDT</span></div><div class="gw-effect-saved" id="gwEffectSaved">Saved: None</div><div id="gwHeaderEffects" class="gw-effects-catalog"></div><label class="gw-effect-reduce-motion"><input type="checkbox" id="gwEffectReducedMotion"><span><strong>Reduce motion</strong><small>Show the design without continuous movement on this device.</small></span></label><div class="gw-custom-actions gw-effect-actions"><button type="button" class="primary" id="gwEffectSave">Save Header Animation</button><button type="button" class="outline" id="gwEffectCancel">Revert Preview</button></div><p id="gwEffectMessage" role="status"></p></section><section id="gwProfileSection"><h3>My Profile Picture</h3><p>Sign in using your employee PIN, then paste a public HTTPS image URL to display your photo on the Employee Roster.</p><div class="gw-profile-settings"><img id="gwProfilePreview" alt="Your profile picture preview" hidden><input id="gwProfileUrl" type="url" placeholder="https://example.com/my-photo.jpg"><button id="gwProfileSave" class="primary" type="button">Save Profile Picture</button></div><p id="gwProfileMessage" role="status"></p></section><div id="gwBrandingSection" hidden><h3>Branding & Images</h3><p>Only authorized administrators can upload images. Branding updates apply to all visitors.</p><div id="gwBrandingAdmin"></div></div><p id="gwSettingsMessage" role="status"></p>`;
document.body.append(root);
const themeGrid=root.querySelector('#gwThemes');
function buildThemeCard(id,mode,palette,name,custom=false){
 const button=document.createElement('button');
 button.type='button';button.className='gw-theme-choice';button.dataset.themeName=id;
 button.setAttribute('aria-label','Apply '+name+' theme');
 const colors={
  '--theme-bg':palette[0],'--theme-panel':palette[1],'--theme-card':palette[2],
  '--theme-border':palette[3],'--theme-text':palette[4],'--theme-muted':palette[5],
  '--theme-accent':palette[6]
 };
 for(const [key,value] of Object.entries(colors))button.style.setProperty(key,value);
 const preview=document.createElement('span');preview.className='gw-theme-mini';
 const previewTop=document.createElement('span');previewTop.className='gw-theme-mini-top';
 const previewMark=document.createElement('span');previewMark.className='gw-theme-mini-mark';previewMark.textContent='✦';
 const previewWord=document.createElement('span');previewWord.className='gw-theme-mini-word';previewWord.textContent='GREEN WONDERLAND';
 const previewAccent=document.createElement('span');previewAccent.className='gw-theme-mini-dot';
 previewTop.append(previewMark,previewWord,previewAccent);
 const previewStats=document.createElement('span');previewStats.className='gw-theme-mini-stats';
 const statLeft=document.createElement('span');statLeft.className='gw-theme-mini-stat';
 const statRight=document.createElement('span');statRight.className='gw-theme-mini-stat';
 const littleLine=document.createElement('span');littleLine.className='gw-theme-mini-line';
 const littleValue=document.createElement('span');littleValue.className='gw-theme-mini-value';littleValue.textContent='$400.00';
 statLeft.append(littleLine,littleValue);
 const rightLine=document.createElement('span');rightLine.className='gw-theme-mini-line';
 const rightBtn=document.createElement('span');rightBtn.className='gw-theme-mini-action';rightBtn.textContent='Checkout';
 statRight.append(rightLine,rightBtn);
 previewStats.append(statLeft,statRight);preview.append(previewTop,previewStats);
 const footer=document.createElement('span');footer.className='gw-theme-card-footer';
 const label=document.createElement('span');label.className='gw-theme-name';label.textContent=name;
 const modeBadge=document.createElement('span');modeBadge.className='gw-theme-mode';modeBadge.textContent=mode;
 footer.append(label,modeBadge);
 button.append(preview,footer);
 if(custom)button.classList.add('gw-theme-custom-choice');
 return button;
}
for(const group of themeGroups){
 const section=document.createElement('section');section.className='gw-theme-group';
 const heading=document.createElement('h4');heading.textContent=group.name;
 const description=document.createElement('p');description.textContent=group.description;
 const grid=document.createElement('div');grid.className='gw-theme-grid';
 for(const [id,mode] of group.choices){
  const choice=buildThemeCard(id,mode,themes[id],labels[id]);
  choice.addEventListener('click',()=>{applyTheme(id);refreshSelection();});
  grid.append(choice);
 }
 section.append(heading,description,grid);themeGrid.append(section);
}
const colorNames=['Background','Panels','Cards','Borders','Text','Muted Text','Accent'];
const customGrid=root.querySelector('#gwCustomColors');
const colors=colorNames.map((label,i)=>{const wrap=document.createElement('label');wrap.className='gw-custom-color';const caption=document.createElement('span');caption.textContent=label;const input=document.createElement('input');input.type='color';input.value=(customPalette()||themes.wonderland)[i];wrap.append(caption,input);customGrid.append(wrap);return input;});
function readColors(){return colors.map(x=>x.value);}
function syncColors(p){colors.forEach((input,i)=>input.value=p[i]);}
const customChoice=buildThemeCard('custom','Custom',customPalette()||themes.wonderland,'My Custom Theme',true);
customChoice.onclick=()=>{if(!customPalette()){root.querySelector('#gwCustomMessage').textContent='Choose your colors below and click Save My Theme first.';return;}applyTheme('custom');refreshSelection();};
const customSection=document.createElement('section');customSection.className='gw-theme-group gw-theme-custom-group';
const customTitle=document.createElement('h4');customTitle.textContent='✎ PERSONALIZED';
const customDesc=document.createElement('p');customDesc.textContent='Your saved seven-color combination.';
const personalGrid=document.createElement('div');personalGrid.className='gw-theme-grid';
personalGrid.append(customChoice);customSection.append(customTitle,customDesc,personalGrid);themeGrid.append(customSection);
function syncCustomSwatch(){
 const p=customPalette()||themes.wonderland;
 const previewColors=['--theme-bg','--theme-panel','--theme-card','--theme-border','--theme-text','--theme-muted','--theme-accent'];
 previewColors.forEach((key,i)=>customChoice.style.setProperty(key,p[i]));
}
root.querySelector('#gwCustomPreview').onclick=()=>{keys.forEach((key,i)=>document.documentElement.style.setProperty(key,readColors()[i]));root.querySelector('#gwCustomMessage').textContent='Preview active. Save to keep it, or select another theme.';};
root.querySelector('#gwCustomSave').onclick=()=>{localStorage.setItem(customKey,JSON.stringify(readColors()));applyTheme('custom');syncCustomSwatch();refreshSelection();root.querySelector('#gwCustomMessage').textContent='Custom theme saved to this browser.';};
root.querySelector('#gwCustomReset').onclick=()=>{syncColors(themes.wonderland);root.querySelector('#gwCustomMessage').textContent='Colors reset to Wonderland defaults. Save to apply.';};
// Browser-only header button fill control: never fades button labels.
const opacitySlider=root.querySelector('#gwButtonOpacity');
const opacityLabel=root.querySelector('#gwButtonOpacityValue');
const opacityMessage=root.querySelector('#gwButtonOpacityMessage');
function savedButtonOpacity(){
 const raw=localStorage.getItem(buttonOpacityKey);
 if(raw===null)return 100;
 const number=Number(raw);
 return Number.isFinite(number)?Math.max(0,Math.min(100,Math.round(number/5)*5)):100;
}
function applyButtonOpacity(value){
 const number=Math.max(0,Math.min(100,Math.round(Number(value)/5)*5));
 const percent=Number.isFinite(number)?number:100;
 document.documentElement.style.setProperty('--gw-header-button-fill',percent+'%');
 opacitySlider.value=String(percent);
 opacityLabel.textContent=percent+'%';
}
opacitySlider.addEventListener('input',()=>{
 applyButtonOpacity(opacitySlider.value);
 opacityMessage.textContent='Previewing '+opacitySlider.value+'% background opacity. Save to keep it.';
});
root.querySelector('#gwButtonOpacitySave').addEventListener('click',()=>{
 localStorage.setItem(buttonOpacityKey,opacitySlider.value);
 opacityMessage.textContent='Button opacity saved on this browser.';
});
root.querySelector('#gwButtonOpacityRevert').addEventListener('click',()=>{
 applyButtonOpacity(savedButtonOpacity());
 opacityMessage.textContent='Preview reverted to saved button opacity.';
});
root.addEventListener('close',()=>{
 if(Number(opacitySlider.value)!==savedButtonOpacity())applyButtonOpacity(savedButtonOpacity());
});
applyButtonOpacity(savedButtonOpacity());
const effectGrid=root.querySelector('#gwHeaderEffects');
const effectMessage=root.querySelector('#gwEffectMessage');
const effectLive=root.querySelector('#gwEffectLivePreview');
const effectReduced=root.querySelector('#gwEffectReducedMotion');
const effectSaved=root.querySelector('#gwEffectSaved');
function savedEffect(){const effect=localStorage.getItem(effectKey)||'none';return effects.some(([id])=>id===effect)?effect:'none';}
function savedReducedMotion(){return localStorage.getItem(motionKey)==='true';}
function applyReducedMotion(value){document.body.dataset.headerMotionReduced=value?'true':'false';effectReduced.checked=Boolean(value);}
function effectLabel(id){return effects.find(([effect])=>effect===id)?.[1]||'None';}
for(const group of effectGroups){
 const section=document.createElement('section');section.className='gw-effect-group';
 const heading=document.createElement('h4');heading.textContent=group.title;
 const description=document.createElement('p');description.textContent=group.description;
 const grid=document.createElement('div');grid.className='gw-effects-grid';
 for(const [id,label,detail] of group.options){
  const button=document.createElement('button');button.type='button';button.className='gw-effect-choice';button.dataset.effect=id;
  button.setAttribute('aria-label','Preview '+label);
  const preview=document.createElement('span');preview.className='gw-effect-preview';preview.dataset.previewEffect=id;
  const word=document.createElement('span');word.className='gw-effect-preview-word';word.textContent='GW';
  preview.append(word);
  const caption=document.createElement('span');caption.className='gw-effect-caption';caption.textContent=label;
  const sub=document.createElement('span');sub.className='gw-effect-desc';sub.textContent=detail;
  button.append(preview,caption,sub);
  button.addEventListener('click',()=>{applyHeaderEffect(id);refreshEffects();effectMessage.textContent='Previewing '+label+'. Save to keep it.';});
  grid.append(button);
 }
 section.append(heading,description,grid);effectGrid.append(section);
}
function refreshEffects(){
 const current=document.body.dataset.headerEffect||'none';
 effectGrid.querySelectorAll('.gw-effect-choice').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.effect===current)));
 effectLive.dataset.previewEffect=current;
 root.querySelector('#gwEffectPreviewName').textContent=effectLabel(current);
 effectSaved.textContent='Saved: '+effectLabel(savedEffect())+(savedReducedMotion()?' · Reduced motion':'');
}
effectReduced.addEventListener('change',()=>{applyReducedMotion(effectReduced.checked);effectMessage.textContent='Motion preference previewing. Save to keep it.';});
root.querySelector('#gwEffectSave').onclick=()=>{
 localStorage.setItem(effectKey,document.body.dataset.headerEffect||'none');
 localStorage.setItem(motionKey,effectReduced.checked?'true':'false');
 refreshEffects();effectMessage.textContent='Header animation and motion preference saved on this browser.';
};
root.querySelector('#gwEffectCancel').onclick=()=>{
 applyHeaderEffect(savedEffect());applyReducedMotion(savedReducedMotion());refreshEffects();
 effectMessage.textContent='Preview reverted to your saved appearance.';
};
root.addEventListener('close',()=>{
 if(document.body.dataset.headerEffect!==savedEffect()||effectReduced.checked!==savedReducedMotion()){
  applyHeaderEffect(savedEffect());applyReducedMotion(savedReducedMotion());refreshEffects();
 }
});
applyHeaderEffect(savedEffect());applyReducedMotion(savedReducedMotion());refreshEffects();syncCustomSwatch();
function refreshSelection(){const selected=activeThemeName(localStorage.getItem(storeKey)||'wonderland');themeGrid.querySelectorAll('button[data-theme-name]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeName===selected)));}
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
 hint.textContent='Upload a PNG, JPG or WebP (up to 3 MB), or paste an HTTPS image URL. Uploads use Boss PIN verification and short-lived Supabase Storage permissions; no Edge Function required.';
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
  try{
   // Anonymous Supabase Auth supplies an RLS identity, not employee authorization.
   // The short-lived Storage grant is issued only after server-side Boss PIN verification.
   let {data:authData,error:authError}=await db.auth.getSession();
   if(authError)throw authError;
   if(!authData.session){
    const signed=await db.auth.signInAnonymously();
    if(signed.error)throw Error('Enable Anonymous Sign-Ins in Supabase Authentication: '+signed.error.message);
   }
   const grant=await db.rpc('gw_authorize_image_upload',{p_token:token});
   if(grant.error||grant.data!==true)throw Error(grant.error?.message||'Boss PIN verification failed');
   const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[picked.type];
   const path='boss/'+crypto.randomUUID()+'.'+ext;
   const result=await db.storage.from('gw-images').upload(path,picked,{contentType:picked.type,upsert:false,cacheControl:'3600'});
   if(result.error)throw result.error;
   const {data:publicImage}=db.storage.from('gw-images').getPublicUrl(path);
   const url=publicImage.publicUrl;
   const saved=await db.rpc('gw_boss_set_image_url',{p_token:token,p_slot:slot.value,
    p_product:slot.value==='product'?String(product.value):null,p_url:url});
   if(saved.error)throw Error('Uploaded, but could not assign image: '+saved.error.message);
   await loadBranding();
   input.value=url;file.value='';
   message('Image uploaded and saved. '+(slot.value==='favicon'?'Refresh the page to update the browser tab.':''));
  }catch(e){message('Upload failed: '+e.message+'. Confirm the Boss browser-upload SQL is installed and Anonymous Sign-Ins are enabled.');}
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
