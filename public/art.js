import { SKINS, GLOVES } from './core.js';
export function hex(s){return [parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];}
export function tint(s,k){return `rgb(${hex(s).map(v=>Math.min(255,Math.max(0,Math.round(v*k)))).join(',')})`;}
function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
export function mapArt(canvas,map,hero=false){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,tint(map.sky,.65));sky.addColorStop(1,'#142723');c.fillStyle=sky;c.fillRect(0,0,w,h);
  c.fillStyle='#e5edb31a';c.beginPath();c.arc(w*.77,h*.2,h*.18,0,7);c.fill();
  const scale=hero?w/35:w/31,ox=w*.53,oy=-h*.32;
  const project=(x,y,z=0)=>[ox+(x-y)*scale,oy+(x+y)*scale*.49-z*scale];
  poly(c,[project(-5,-5),project(32,-5),project(32,32),project(-5,32)],tint(map.floor,.77));
  c.strokeStyle='#ced3a612';c.lineWidth=1;for(let i=0;i<30;i++){c.beginPath();c.moveTo(...project(i,0));c.lineTo(...project(i,30));c.stroke();c.beginPath();c.moveTo(...project(0,i));c.lineTo(...project(30,i));c.stroke();}
  for(const x of [9,15]){poly(c,[project(x,0),project(x+.13,0),project(x+.13,26),project(x,26)],'#d5ce9580');}
  const box=(x,y,bw,bh,z,color)=>{
    poly(c,[project(x+bw,y),project(x+bw+z*.9,y+.4),project(x+bw+z*.9,y+bh+z*.5),project(x,y+bh)],'#0a171b55');
    poly(c,[project(x,y,z),project(x+bw,y,z),project(x+bw,y+bh,z),project(x,y+bh,z)],tint(color,1.3));
    poly(c,[project(x,y+bh,z),project(x+bw,y+bh,z),project(x+bw,y+bh),project(x,y+bh)],tint(color,.83));
    poly(c,[project(x+bw,y,z),project(x+bw,y+bh,z),project(x+bw,y+bh),project(x+bw,y)],tint(color,.56));
    c.strokeStyle='#111c2355';c.lineWidth=1;for(let k=.35;k<bw;k+=.55){c.beginPath();c.moveTo(...project(x+k,y+bh,z-.08));c.lineTo(...project(x+k,y+bh,.05));c.stroke();}
    if(bw>1.5){poly(c,[project(x+.22,y+bh+.01,z*.68),project(x+Math.min(bw-.2,1.1),y+bh+.01,z*.68),project(x+Math.min(bw-.2,1.1),y+bh+.01,z*.32),project(x+.22,y+bh+.01,z*.32)],'#182829');}
  };
  const blocks=map.blocks.map(b=>[...b]);blocks.push([1,1,1,21,1],[1,1,21,1,1]);blocks.sort((a,b)=>a[0]+a[1]-b[0]-b[1]);
  for(const [x,y,bw,bh,t]of blocks)box(x,y,bw,bh,t===3?.8:t===2?1.7:map.id==='city'?3.9:3,t===2?map.accent:map.wall);
  for(const [x,y]of [[8,12],[15,15],[18,8],[3,9]])box(x,y,.8,.8,.7,map.accent);
  if(hero){const [x,y]=project(14,18);c.fillStyle='#07120f66';c.beginPath();c.ellipse(x,y,12,5,0,0,7);c.fill();const sprite=makeOperator('#5b7367','#cede9e');c.drawImage(sprite,x-17,y-61,34,64);}
  const fade=c.createLinearGradient(0,h*.2,0,h);fade.addColorStop(0,'#0c211400');fade.addColorStop(1,'#071c2266');c.fillStyle=fade;c.fillRect(0,0,w,h);
  c.strokeStyle='#dfebc817';for(let i=0;i<h;i+=4){c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}
}
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
export function textures(map){
  let seed=97;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  return [null,...[1,2,3].map(type=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');c.fillStyle=type===2?map.accent:map.wall;c.fillRect(0,0,64,64);
    for(let i=0;i<2800;i++){c.fillStyle=rand()>.5?'#ffffff0b':'#00000010';c.fillRect(rand()*64,rand()*64,1+rand()*3,1+rand()*2);}
    if(type===1){c.fillStyle='#15221f55';for(let y=0;y<64;y+=16)c.fillRect(0,y,64,1);for(let y=0;y<64;y+=16)for(let x=(y%32?16:0);x<64;x+=32)c.fillRect(x,y,1,16);c.fillStyle='#e2dfb522';c.fillRect(0,1,64,1);}
    if(type===2){for(let x=0;x<64;x+=8){c.fillStyle='#121c2244';c.fillRect(x,0,2,64);c.fillStyle='#fff1c522';c.fillRect(x+2,0,1,64);}c.fillStyle='#22302c';c.fillRect(0,4,64,3);c.fillRect(0,58,64,3);c.fillStyle='#e2d8b3';c.fillRect(22,19,21,12);c.fillStyle='#544e38';c.font='bold 8px monospace';c.fillText('07',26,28);}
    if(type===3){c.fillStyle='#202d2bbb';c.fillRect(0,0,64,5);c.fillRect(0,59,64,5);c.fillRect(0,0,5,64);c.fillRect(59,0,5,64);c.strokeStyle='#2a342b';c.lineWidth=6;c.beginPath();c.moveTo(5,5);c.lineTo(59,59);c.moveTo(59,5);c.lineTo(5,59);c.stroke();}
    return cv;})];
}
