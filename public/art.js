import { SKINS, GLOVES, floorHeight } from './core.js';
export function hex(s){return [parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];}
export function tint(s,k){return `rgb(${hex(s).map(v=>Math.min(255,Math.max(0,Math.round(v*k)))).join(',')})`;}
function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
// Render the playable grid itself as a sandstone model, like the reference photo.
function architecturalMapArt(canvas,map,hero){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,n=map.size;
  const u=Math.min((w-40)/(n*2),(h-50)/(n+4)),ox=w/2,oy=(h-28-n*u)/2+u;
  const p=(x,y,z=0)=>[ox+(x-y)*u,oy+(x+y)*u*.5-z*u];
  c.imageSmoothingEnabled=false;c.clearRect(0,0,w,h);c.fillStyle='#202725';c.fillRect(0,0,w,h);
  const scale=map.heightScale,step=1/scale;
  const eastColor=tint(map.wall,.64),southColor=tint(map.wall,.85),floorColors=[tint(map.floor,1.04),tint(map.floor,1.14)];
  for(let d=0;d<n*scale*2;d++)for(let iy=0;iy<n*scale;iy++){
    const ix=d-iy;if(ix<0||ix>=n*scale)continue;
    const x=ix/scale,y=iy/scale,gx=Math.floor(x),gy=Math.floor(y),solid=map.grid[gy][gx];
    if(solid&&![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>map.grid[gy+dy]?.[gx+dx]===0))continue;
    const z=solid?2.7:floorHeight(map,x+step*.5,y+step*.5);
    const east=solid?0:floorHeight(map,x+step*1.5,y+step*.5),south=solid?0:floorHeight(map,x+step*.5,y+step*1.5);
    if(z>east)poly(c,[p(x+step,y,east),p(x+step,y+step,east),p(x+step,y+step,z),p(x+step,y,z)],eastColor);
    if(z>south)poly(c,[p(x,y+step,south),p(x+step,y+step,south),p(x+step,y+step,z),p(x,y+step,z)],southColor);
    const top=solid?(map.id==='dust2'&&solid===3?'#806443':map.light):floorColors[(gx+gy)%3===0?0:1];
    poly(c,[p(x,y,z),p(x+step,y,z),p(x+step,y+step,z),p(x,y+step,z)],top);
  }
  const labels=[{name:'A',point:map.sites.a.point},{name:'B',point:map.sites.b.point},{name:'MID',point:map.mid.point}];
  if(hero)labels.push(...map.callouts.filter(a=>['ПАЛАЦ','АПАРТАМЕНТИ','РИНОК','LONG A','SHORT A','ВЕРХНІ ТУНЕЛІ','ФОНТАН','ТУАЛЕТИ','MONSTER','HEAVEN','КАНАЛ','ХРАМ','DONUT','ПЕЧЕРА','РУЇНИ','LONG B','BANANA','АРКА','ALT MID','ЛІФТИ','РИШТУВАННЯ','СХОДИ B','ГАРАЖ','ПАПІР','ПРОЄКТОР','A MAIN','B MAIN','CHECKERS','OUTSIDE','RAMP','SECRET','CT','T'].includes(a.name)));
  c.textAlign='center';c.textBaseline='middle';c.font=`bold ${hero?11:10}px monospace`;
  for(const label of labels){const [x,y]=p(...label.point,floorHeight(map,...label.point)),width=label.name.length*(hero?7:6)+10;c.fillStyle='#172623e8';c.fillRect(x-width/2,y-8,width,16);c.fillStyle='#f3dfb3';c.fillText(label.name,x,y);}
  c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle='#f3dfb3';c.font='bold 12px monospace';c.fillText(map.name.replace(' · ',' / '),16,h-13);
  c.textAlign='right';c.fillStyle='#a5b8b0';c.font='10px monospace';c.fillText('A · MID · B',w-16,h-13);c.textAlign='left';
}
function paintMapTexture(c,map,type){
  if(map.id==='dust2'&&type===3){
    // Fixed open door leaves: weathered timber, iron straps and rivets.
    c.fillStyle='#725536';c.fillRect(0,0,64,64);
    for(let x=0;x<64;x+=8){
      c.fillStyle=x%16?'#846440':'#98764d';c.fillRect(x+1,0,6,64);
      c.fillStyle='#493b2b';c.fillRect(x,0,1,64);
    }
    for(const y of [10,46]){
      c.fillStyle='#343b36';c.fillRect(0,y,64,6);
      c.fillStyle='#a59a79';for(let x=4;x<64;x+=16)c.fillRect(x,y+2,2,2);
    }
    c.fillStyle='#292f2b';c.fillRect(27,29,10,8);
    c.fillStyle='#b8a17a';c.fillRect(29,31,6,4);
    return;
  }
  if(map.id==='dust2'&&type===2){
    c.fillStyle='#aa8c5e';c.fillRect(0,0,64,64);
    for(let y=0;y<64;y+=16)for(let x=-((y/16)%2)*16;x<64;x+=32){
      c.fillStyle=(x+y)%3?'#c1a475':'#b89b6c';c.fillRect(x+1,y+1,30,14);
      c.fillStyle='#dfc99e';c.fillRect(x+2,y+1,28,2);
      c.fillStyle='#7d694b';c.fillRect(x,y+15,32,1);
    }
    return;
  }
  if(map.id==='office'&&type===3){
    c.fillStyle='#596b78';c.fillRect(0,0,64,64);
    c.fillStyle='#a9b6ba';c.fillRect(5,3,54,61);
    c.fillStyle='#6c574b';c.fillRect(9,7,46,57);
    c.fillStyle='#8e7660';c.fillRect(12,10,40,54);
    c.fillStyle='#394e5b';c.fillRect(17,16,30,19);
    c.fillStyle='#bec8c6';c.fillRect(43,42,8,2);
    return;
  }
  if(type!==1)return;
  const light=tint(map.light,.62),shadow=tint(map.wall,.42),r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  switch(map.id){
    case 'dust2':
      // Sun-bleached plaster above a rough sandstone base, without tiled windows.
      r(0,0,64,64,'#dac9a5');r(0,0,64,4,'#f4e5c4');
      for(let y=5;y<43;y+=4)for(let x=2;x<64;x+=5){
        if((x*7+y*11)%9<3)r(x,y,2,1,(x+y)%2?'#cbb891':'#e7d8b9');
      }
      r(0,42,64,3,'#8f9e99');r(0,45,64,19,'#b39970');
      for(let y=46;y<64;y+=9){r(0,y,64,1,'#8e7656');for(let x=y===46?0:12;x<64;x+=24)r(x,y,1,9,'#8e7656');}
      r(11,13,1,7,'#baa985');r(12,20,1,4,'#baa985');r(10,24,2,1,'#baa985');
      r(45,33,7,2,'#c3af89');r(47,35,9,3,'#c3af89');break;
    case 'overpass':
      r(0,0,64,64,'#a6aaa0');r(0,2,64,2,'#d1d1bd');
      r(0,31,64,2,'#747d77');r(31,0,2,64,'#747d77');
      for(const x of [5,55])for(const y of [7,24,39,56]){r(x,y,3,3,'#656f69');r(x,y,2,1,'#d2d0b9');}
      r(0,48,64,9,'#668d85');r(0,57,64,7,'#757d70');
      for(let x=3;x<64;x+=11)r(x,59,2,5,'#666d61');break;
    case 'vertigo':
      r(0,0,64,64,'#a4aaa8');r(0,30,64,2,'#737e7c');
      for(const x of [5,54])for(const y of [7,22,39,54]){r(x,y,3,3,'#677371');r(x,y,2,1,'#d3d6cc');}
      for(let x=0;x<64;x+=8){r(x,46,8,8,x%16?'#414a49':'#d5b756');}
      r(0,55,64,9,'#7e8986');break;
    case 'office':
      r(0,0,64,64,'#d7dedd');r(0,0,64,3,'#f0f1e9');
      for(let x=0;x<64;x+=32){r(x,3,1,45,'#bac7c9');r(x+1,3,1,45,'#e8ede7');}
      r(0,43,64,3,'#627785');r(0,46,64,15,'#80949e');r(0,61,64,3,'#465964');break;
    case 'cache':
      r(0,0,64,64,'#d5d2b9');
      for(let y=0;y<64;y+=10){r(0,y,64,1,'#92977f');for(let x=(y/10%2)*12;x<64;x+=24)r(x,y,1,10,'#92977f');}
      r(0,41,64,12,'#608574');r(0,53,64,2,'#405e52');
      for(let x=2;x<64;x+=9){r(x,55,3,9,'#929a77');r(x+2,59,2,5,'#687a59');}break;
    case 'nuke':
      r(0,0,64,64,'#b7c4c8');
      for(let x=0;x<64;x+=8){r(x,0,2,64,'#788f99');r(x+2,0,1,64,'#dce4df');}
      r(0,36,64,15,'#517789');r(0,51,64,3,'#324f60');
      for(let x=0;x<64;x+=8)r(x,56,8,6,x%16?'#424b48':'#dcc266');
      for(const x of [4,58])for(const y of [5,29])r(x,y,2,2,'#526a73');break;
    case 'inferno':
      // Warm village plaster, exposed terracotta brick and a stone cornice.
      r(0,0,64,64,'#d6b78c');r(0,0,64,4,'#f3dfb9');r(0,4,64,2,'#9d7658');
      for(let y=8;y<42;y+=7)for(let x=3;x<64;x+=11)if((x+y)%3===0)r(x,y,4,2,'#c5a279');
      r(0,42,64,22,'#8b5744');
      for(let y=43;y<64;y+=7)for(let x=-((y-43)/7%2)*9;x<64;x+=18){r(x+1,y,16,5,'#b57a59');r(x+2,y,14,1,'#d49d74');}
      r(0,39,64,3,'#b09470');r(8,18,1,10,'#b99770');r(9,28,3,1,'#b99770');break;
    case 'ancient':
      r(0,0,64,64,'#65734e');
      for(let y=0;y<64;y+=16)for(let x=-((y/16)%2)*16;x<64;x+=32){
        r(x+1,y+1,30,14,(x+y)%3?'#829165':'#76855a');
        r(x+2,y+1,28,2,'#a5b480');r(x,y+14,32,2,'#48563b');
      }
      for(let x=2;x<64;x+=7){const h=4+(x*3)%11;r(x,0,3,h,'#465d39');r(x+1,h,2,3,'#5c7547');}
      r(22,21,20,23,'#566443');r(24,23,16,19,'#a4af78');
      r(28,26,8,3,'#5f7048');r(28,29,3,10,'#5f7048');r(31,36,5,3,'#5f7048');break;
    case 'mirage':
      r(0,0,64,40,tint(map.wall,1.08));r(0,40,64,3,light);
      for(let y=45;y<64;y+=9){r(0,y,64,1,shadow);for(let x=y%2?12:0;x<64;x+=24)r(x,y,1,9,shadow);}
      r(19,10,26,24,light);r(22,12,20,19,shadow);r(23,13,18,17,map.accent);
      for(let y=15;y<30;y+=4)r(24,y,16,1,shadow);
      r(17,33,30,3,light);break;

  }
}
export function mapArt(canvas,map,hero=false){architecturalMapArt(canvas,map,hero);}
export function makeOperator(color,accent='#dbaa69',glove='#333b37'){
  const cv=document.createElement('canvas');cv.width=128;cv.height=256;const c=cv.getContext('2d');
  const r=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
  poly(c,[[38,150],[62,148],[62,217],[54,237],[34,235]],tint(color,.77));poly(c,[[66,150],[88,150],[95,235],[75,237],[67,209]],tint(color,.9));
  r(34,188,26,16,tint(color,.52));r(72,188,24,16,tint(color,.55));r(29,231,30,16,'#1e2829');r(74,231,29,16,'#1e2829');r(32,245,29,5,'#0f1619');r(73,245,34,5,'#0f1619');
  poly(c,[[33,64],[89,64],[98,91],[88,160],[38,160],[28,89]],color);poly(c,[[31,66],[18,78],[11,121],[24,137],[35,105]],tint(color,.9));poly(c,[[87,68],[104,76],[117,116],[102,137],[89,103]],tint(color,1.05));
  r(39,70,49,76,tint(color,.55));r(44,76,38,8,tint(color,1.15));r(43,99,17,23,tint(color,.85));r(64,99,18,23,tint(color,.8));r(40,134,48,8,'#263531');r(35,149,57,9,'#25342e');
  r(19,82,9,9,accent);r(97,82,8,9,accent);r(48,86,22,3,accent);r(53,53,22,15,'#655e4e');
  poly(c,[[44,16],[82,16],[93,32],[90,54],[77,66],[49,60],[38,41]],tint(color,.65));poly(c,[[44,12],[82,12],[93,28],[91,36],[36,36],[36,27]],tint(color,1.2));r(39,32,51,11,'#1b2a2a');r(44,35,39,3,accent);r(49,48,30,13,'#283330');r(55,51,18,3,'#536259');
  poly(c,[[15,116],[23,107],[60,112],[59,129],[23,136]],tint(color,.8));poly(c,[[107,111],[117,120],[91,141],[69,131],[74,117]],tint(color,.75));r(50,112,17,17,glove);r(71,116,16,17,glove);
  r(49,101,56,12,'#212b2c');r(68,90,31,12,'#36443f');r(94,104,32,6,'#192528');r(70,112,11,20,'#172323');r(59,105,4,4,accent);r(48,102,13,7,'#4f5b51');
  return cv;
}
export function drawOperator(canvas,skin,glove){const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.strokeStyle='#c8e19a13';for(let i=0;i<w;i+=40){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();}for(let i=0;i<h;i+=40){c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}c.fillStyle='#070e0c55';c.beginPath();c.ellipse(w*.5,h*.94,100,14,0,0,7);c.fill();const sprite=makeOperator(SKINS[skin].color,'#c3f66b',GLOVES[glove].color);c.imageSmoothingEnabled=false;c.drawImage(sprite,w*.5-111,25,222,h-45);}
export const WEAPON_FILES = { pistol:'assets/weapons/pistol.png', smg:'assets/weapons/smg.png', rifle:'assets/weapons/rifle.png', shotgun:'assets/weapons/shotgun.png', kalash:'assets/weapons/kalash.png' };
// Текстури зброї з itch.io (AystarGames, CC0). У середовищі без DOM (тести) повертає {}.
export function loadWeaponSprites(){
  const out={};
  if(typeof Image==='undefined')return out;
  for(const [id,src] of Object.entries(WEAPON_FILES)){const img=new Image();img.decoding='async';img.src=src;out[id]=img;}
  return out;
}
export function weaponSpriteReady(img){return !!img&&img.complete&&img.naturalWidth>0;}
export const WEAPON_MUZZLES={pistol:155,glock:160,p250:160,dualies:165,deagle:175,fiveseven:160,tec9:160,cz75:155,smg:215,mac10:210,mp5:215,mp7:215,ump45:220,p90:225,bizon:220,rifle:290,kalash:290,famas:285,galil:290,m4a1:285,aug:295,sg553:295,shotgun:315,xm1014:310,mag7:300,sawedoff:295,marksman:345,sniper:385,g3sg1:360,scar20:360,negev:310,m249:315};
const SCOPED_OVERLAY=new Set(['marksman','sniper','aug','sg553','g3sg1','scar20']);
export function drawScopeOverlay(c,w,h,id,alpha=1){
  if(!SCOPED_OVERLAY.has(id)||alpha<=0)return;
  const cx=w*.5,cy=h*.5,r=Math.min(w,h)*(id==='sniper'?.45:id==='marksman'?.42:.36);
  c.save();c.globalAlpha=alpha;c.fillStyle='#020506';c.beginPath();c.rect(0,0,w,h);c.arc(cx,cy,r,0,Math.PI*2,true);c.fill('evenodd');
  c.strokeStyle='#303b3b';c.lineWidth=Math.max(5,Math.round(r*.045));c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();
  c.strokeStyle='#a7c58b';c.lineWidth=1;c.globalAlpha=alpha*.72;
  c.beginPath();c.moveTo(cx-r*.66,cy);c.lineTo(cx+r*.66,cy);c.moveTo(cx,cy-r*.66);c.lineTo(cx,cy+r*.66);c.stroke();
  for(const s of [-1,1])for(let i=1;i<=4;i++){
    const d=i*r*.12;c.beginPath();c.moveTo(cx+s*d,cy-5);c.lineTo(cx+s*d,cy+5);c.moveTo(cx-5,cy+s*d);c.lineTo(cx+5,cy+s*d);c.stroke();
  }
  c.fillStyle='#d9f1bd';c.fillRect(cx-2,cy-2,4,4);c.restore();
}
// Rear view down the barrel. The front sight's tip is exactly (0, 0),
// matching the screen-centre ray used for hit detection.
export function drawWeaponSights(c,id,{skin,glove,flash=0}={}){
  const pistol=id==='pistol',ak=id==='kalash',shotgun=id==='shotgun';
  const shape=(points,color)=>{poly(c,points,color);c.strokeStyle='#11191f';c.lineWidth=2;c.lineJoin='round';c.stroke();};
  const line=(points,color,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
  const body=pistol?40:id==='smg'?48:shotgun?54:ak?56:60,front=pistol?12:18,kick=flash>0?flash*6:0;
  // Hands and sleeves stay below the sight picture.
  shape([[-body,125],[-body-38,175],[-180,500],[-40,500],[6,210]],tint(skin,.8));
  shape([[body-3,120],[body+43,157],[190,500],[50,500],[-7,210]],skin);
  shape([[-body-4,101],[-body-27,139],[-body-16,196],[-12,211],[9,165],[-9,125]],glove);
  shape([[body-8,112],[body+25,143],[body+17,206],[14,223],[-10,171],[10,133]],glove);
  // Tapered top plane gives a view along the weapon rather than its side.
  const fore=ak||shotgun?'#995d35':id==='rifle'?'#596451':'#3e4b54';
  shape([[-front,25],[front,25],[body,187+kick],[-body,187+kick]],fore);
  shape([[-front,25],[-body,187+kick],[-body,285],[-front-10,72]],'#263039');
  shape([[front,25],[front+10,72],[body,285],[body,187+kick]],'#1d272f');
  if(ak||shotgun){
    for(let i=0;i<6;i++){const y=50+i*13,half=front+(body-front)*(y-25)/162;line([[-half+3,y],[half-3,y]],'#593d2c',3);}
  }else if(!pistol){
    for(let i=0;i<8;i++){const y=40+i*11,half=10+i*2;line([[-half,y],[half,y]],'#899396',3);}
  }
  shape([[-body+7,116+kick],[body-7,116+kick],[body+12,265],[-body-12,265]],'#47535c');
  shape([[-body+14,124+kick],[body-14,124+kick],[body-1,244],[-body+1,244]],'#67747b');
  line([[0,125+kick],[0,243]],'#8a989d');
  if(pistol){
    for(let i=0;i<5;i++){const y=161+i*15;line([[-body+10,y],[-body+18,y+8]],'#212d36',3);line([[body-10,y],[body-18,y+8]],'#212d36',3);}
  }else{
    shape([[body-1,149],[body+23,155],[body+24,168],[body+2,166]],'#8a989b');
  }
  // Rear sight is connected to the receiver and leaves the target visible.
  shape([[-body+2,13],[-18,0],[-11,0],[-11,28],[11,28],[11,0],[18,0],[body-2,13],[body-2,38],[-body+2,38]],'#202b33');
  shape([[-body+2,38],[-body+10,38],[-body+6,123],[-body-4,123]],'#303d46');
  shape([[body-10,38],[body-2,38],[body+4,123],[body-6,123]],'#303d46');
  line([[-body+2,14],[-19,2],[-12,2]],'#93a0a5',3);
  line([[12,2],[19,2],[body-2,14]],'#93a0a5',3);
  if(id==='rifle'||id==='smg'){
    // Aperture sight: thin ring, never a filled disc over the target.
    c.strokeStyle='#202b33';c.lineWidth=6;c.beginPath();c.arc(0,0,27,0,Math.PI*2);c.stroke();
    c.strokeStyle='#8b999b';c.lineWidth=1.5;c.beginPath();c.arc(0,0,30,Math.PI,Math.PI*2);c.stroke();
  }else{
    c.fillStyle='#d1ddab';c.fillRect(-25,8,5,4);c.fillRect(20,8,5,4);
  }
  // Bright tip at the exact aim point; the post extends down, not over it.
  shape([[-3,0],[3,0],[5,26],[-5,26]],'#18232b');
  c.fillStyle='#d4ee9a';c.fillRect(-2,0,4,3);
  if(flash>.55){
    // Muzzle gas to either side preserves the centre of the sight picture.
    for(const side of [-1,1])poly(c,[[side*34,15],[side*62,-8],[side*48,17],[side*76,25],[side*40,29]],'#ffd18a');
  }
}
// Large, continuous silhouettes with visible upper faces and separate grips.
// Coordinates run from the muzzle on the left to the stock on the right.
export function drawHeldWeapon(c,id,{skin,glove,ads=0,reload=0,flash=0}={}){
  const pistol=id==='pistol',ak=id==='kalash',shotgun=id==='shotgun',scoped=id==='marksman'||id==='sniper';
  const metal='#39444c',edge='#82919a',dark='#1b232b',wood='#95572d';
  const shape=(points,color)=>{
    poly(c,points,color);c.strokeStyle='#101820';c.lineWidth=2;c.lineJoin='round';c.stroke();
  };
  const line=(points,color,width=2)=>{
    c.strokeStyle=color;c.lineWidth=width;c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  };
  const solid=(points,color,depth=9)=>{
    const top=points.map(([x,y])=>[x-depth*.65,y-depth]);
    shape(top,tint(color,1.4));
    for(let i=0;i<points.length;i++){
      const j=(i+1)%points.length;
      shape([points[i],points[j],top[j],top[i]],tint(color,points[j][0]>points[i][0]?1.35:.7));
    }
    shape(points,color);
  };
  const rect=(x,y,w,h,color,depth=7)=>solid([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],color,depth);
  const hand=(x,y,angle=0)=>{
    c.save();c.translate(x,y);c.rotate(angle);
    solid([[-23,-15],[9,-22],[28,-9],[29,32],[12,47],[-19,37]],glove,5);
    for(let i=0;i<3;i++)line([[-17,1+i*10],[17,5+i*10]],tint(glove,1.55),3);
    shape([[-20,-13],[-8,-23],[7,-18],[14,9],[1,18],[-11,8]],tint(glove,1.3));
    c.restore();
  };
  const angle=.48+ads*.85;
  const sleeveEnd=(x,y)=>[x*Math.cos(angle)+y*Math.sin(angle),-x*Math.sin(angle)+y*Math.cos(angle)];
  c.save();c.translate(0,-120);c.rotate(angle);
  // Sleeves sit behind the gun, with hands wrapping the grip and fore-end.
  solid([[55,88],[105,100],sleeveEnd(240,600),sleeveEnd(80,600),[68,157]],skin,10);
  if(!pistol)solid([[-145,60],[-112,76],[-110,160],sleeveEnd(-300,600),sleeveEnd(-460,600),[-162,113]],tint(skin,.8),8);
  if(pistol){
    solid([[10,10],[63,12],[82,109],[31,119],[10,94]],dark,12);
    rect(25,99,59,13,'#303941');
    if(reload>.15&&reload<.58){
      c.save();c.translate(43,105+(reload-.15)*320);c.rotate((reload-.15)*1.4);
      c.globalAlpha=1-(reload-.15)*1.8;rect(-9,0,25,65,metal,6);c.restore();
    }
    for(let i=0;i<6;i++)line([[30+i*3,37+i*10],[58+i*3,34+i*10]],'#525c60',2);
    // Open trigger guard, with a distinct curved trigger inside.
    line([[-42,15],[-36,59],[12,63],[28,33]],dark,10);
    line([[-13,18],[-18,36],[-7,44]],edge,4);
    solid([[-149,-10],[65,-10],[64,20],[8,31],[-47,25],[-149,15]],'#424c52',11);
    const slide=flash>.55?13:0;
    c.save();c.translate(slide,0);
    solid([[-155,-48],[49,-48],[65,-34],[63,-8],[-155,-8]],metal,13);
    rect(-85,-45,36,12,'#131d24',2);
    for(let i=0;i<6;i++)line([[20+i*6,-39],[15+i*6,-14]],edge,2);
    rect(-143,-61,10,12,dark,3);rect(44,-61,13,12,dark,4);
    c.restore();
    hand(57,73,-.18);
    line([[-145,-43],[-102,-43]],'#b1bec4',2);
  }else{
    // Stock and pistol grip: rifle/AK have full stocks; SMG has a folding stock.
    if(id==='smg'){
      line([[69,-13],[156,-10],[174,30]],'#7e8a90',10);
      line([[71,14],[153,16],[174,50]],dark,9);rect(163,17,17,47,dark);
    }else{
      solid([[65,-21],[102,-20],[169,1],[180,63],[150,77],[78,25]],ak||shotgun?wood:scoped?'#555d57':'#414c46',13);
      solid([[167,-1],[180,2],[191,66],[177,74]],dark,8);
      if(ak||shotgun)line([[109,9],[151,23],[164,53]],'#c38a50',3);
      else line([[108,6],[149,20],[156,46],[129,40]],'#8b988b',3);
    }
    solid([[23,18],[66,23],[84,95],[49,112],[22,91]],ak?'#70472e':dark,9);
    line([[-22,27],[-15,63],[23,68],[40,38]],dark,9);
    line([[3,27],[-1,43],[9,49]],edge,3);
    // Magazines remain visibly separate from the firing hand.
    if(!shotgun){
      const removed=reload>.15&&reload<.58;
      c.save();if(removed){c.translate(0,(reload-.15)*310);c.rotate((reload-.15)*.8);c.globalAlpha=1-(reload-.15)*1.8;}
      if(ak){
        solid([[-84,22],[-42,26],[-39,65],[-21,106],[7,128],[-18,149],[-53,126],[-72,92]],'#303941',10);
        for(let i=0;i<3;i++)line([[-72+i*10,39],[-63+i*10,85],[-44+i*10,116],[-18+i*10,135]],'#6a7379',3);
      }else{
        const length=id==='smg'?107:scoped?104:82;
        solid([[-69,20],[-32,24],[-23,length],[-63,length+7]],id==='rifle'?'#626958':scoped?'#4b5556':dark,9);
        for(let i=0;i<3;i++)line([[-60+i*10,39],[-55+i*10,length-9]],'#8a9181',2);
        rect(-63,length-4,43,12,dark,4);
      }
      c.restore();
    }
    // Long barrel and (for the shotgun) the lower magazine tube.
    const muzzle=WEAPON_MUZZLES[id];
    rect(-muzzle,-30,muzzle-137,14,'#46525b',7);
    rect(-muzzle,-34,23,23,dark,7);
    line([[-muzzle+6,-31],[-muzzle+6,-16]],'#88969d',2);
    if(shotgun)rect(-284,-8,177,12,dark,7);
    if(ak)rect(-245,-48,107,9,dark,5);
    // Front sight visibly breaks the barrel silhouette.
    rect(-muzzle+43,-57,9,28,dark,4);
    line([[-muzzle+39,-54],[-muzzle+49,-64],[-muzzle+58,-54]],edge,4);
    const fore=ak||shotgun?wood:id==='rifle'?'#4d5e4e':scoped?'#5b6257':'#353f48';
    solid([[-203,-34],[-91,-34],[-81,16],[-188,16],[-206,3]],fore,12);
    for(let i=0;i<(ak?3:7);i++)line([[-187+i*13,-23],[-182+i*13,8]],tint(fore,.52),4);
    // Receiver, top cover, ejection port, charging handle and fasteners.
    solid([[-104,-40],[64,-40],[81,-23],[72,22],[-95,22]],metal,14);
    solid([[-91,-50],[48,-50],[63,-40],[-104,-40]],'#67747b',6);
    if(scoped){
      const optic=id==='sniper'?98:78;
      solid([[-optic*.48,-112],[optic*.36,-112],[optic*.48,-78],[-optic*.58,-78]],'#263138',12);
      rect(-optic*.43,-107,optic*.82,22,'#111a20',6);
      c.fillStyle='#93b4a0';c.fillRect(-optic*.34,-103,optic*.62,5);
      c.fillStyle='#17232a';c.beginPath();c.arc(-optic*.46,-96,13,0,Math.PI*2);c.fill();c.beginPath();c.arc(optic*.4,-96,13,0,Math.PI*2);c.fill();
      c.strokeStyle='#9bab9d';c.lineWidth=3;c.beginPath();c.moveTo(-18,-78);c.lineTo(-18,-55);c.moveTo(20,-78);c.lineTo(20,-55);c.stroke();
    }
    rect(-40,-30,54,18,'#131c22',3);
    line([[-33,-26],[7,-26]],'#a0a9a9',3);
    rect(1,-15,29,6,'#839096',4);
    for(const x of [-82,49]){c.fillStyle='#a4adae';c.beginPath();c.arc(x,7,3,0,Math.PI*2);c.fill();}
    if(!ak&&!shotgun){
      for(let i=0;i<12;i++)rect(-91+i*12,-60,7,7,dark,3);
      // Compact rear sight, with daylight through its centre.
      line([[24,-53],[24,-79],[51,-79],[51,-53]],dark,8);
      line([[27,-76],[48,-76]],'#90a2a4',2);
    }else rect(38,-64,14,12,dark,4);
    hand(56,82,-.23);
    hand(-151,35,.1);
  }
  if(flash>.55&&reload<=0){
    c.save();c.translate(-WEAPON_MUZZLES[id]-9,pistol?-27:-24);
    poly(c,[[-68,0],[-20,-8],[-36,-27],[-9,-15],[6,-29],[7,-7],[24,0],[7,9],[1,27],[-10,13],[-39,28],[-23,9]],'#ffbc51');
    poly(c,[[-39,0],[-5,-8],[12,0],[-5,8]],'#fff5cb');c.restore();
  }
  c.restore();
}
export function textures(map){
  let seed=97;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  return [null,...[1,2,3].map(type=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
    const base=type===2?map.accent:type===3?tint(map.wall,.6):map.wall;c.fillStyle=base;c.fillRect(0,0,64,64);
    for(let y=0;y<64;y+=8)for(let x=0;x<64;x+=8){c.fillStyle=(x/8+y/8+Math.floor(rand()*3))%3===0?tint(base,.76):tint(base,1.04);c.fillRect(x,y,8,8);c.fillStyle='#ffffff16';c.fillRect(x+1,y+1,6,1);if(rand()>.64){c.fillStyle='#07121038';c.fillRect(x+2,y+4,2,2);}}
    // Masonry and facade patterns keep the walls architectural.
    if(type===1){
      c.fillStyle='#10201e55';
      for(let y=0;y<64;y+=12){c.fillRect(0,y,64,2);for(let x=(Math.floor(y/12)%2?9:1);x<64;x+=18)c.fillRect(x,y,2,12);}
      c.fillStyle='#e2dfb533';c.fillRect(0,2,64,2);
    }
    if(type===2){
      c.fillStyle='#17232155';for(let y=8;y<60;y+=16)c.fillRect(0,y,64,2);
      c.fillStyle='#f1e5bb38';for(const x of [5,29,53]){c.fillRect(x,0,4,64);c.fillRect(x-2,5,8,3);}
      c.fillStyle='#15201f77';c.fillRect(0,5,64,3);c.fillRect(0,56,64,3);
    }
    if(type===3){
      c.fillStyle='#202d2b99';for(let y=0;y<64;y+=10)c.fillRect(0,y,64,3);
      c.fillStyle='#d7d0ad28';for(let x=5;x<64;x+=15)c.fillRect(x,3,2,58);
      c.fillStyle='#0d161955';c.fillRect(0,0,64,5);c.fillRect(0,59,64,5);
    }
    paintMapTexture(c,map,type);
    return cv;})];
}
