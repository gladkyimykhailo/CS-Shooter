import { tint } from './art.js';

// Horizontal treads and vertical risers along a camera ray, in near-to-far order.
// Ray length is camera depth (the direction deliberately isn't normalized).
export function terrainColumn(map,px,py,rx,ry){
  const scale=map.heightScale,surfaces=[];
  let x=Math.floor(px*scale),y=Math.floor(py*scale),near=.001;
  const sx=rx<0?-1:1,sy=ry<0?-1:1,dx=Math.abs(1/(rx*scale)),dy=Math.abs(1/(ry*scale));
  let nextX=rx===0?Infinity:((x+(rx<0?0:1))/scale-px)/rx;
  let nextY=ry===0?Infinity:((y+(ry<0?0:1))/scale-py)/ry;
  for(let i=0;i<map.size*scale*2+4;i++){
    const z=map.heights[y]?.[x]||0,gx=Math.floor(x/scale),gy=Math.floor(y/scale);
    const side=nextX<nextY?0:1,far=Math.max(near,side?nextY:nextX);
    const material=map.ground[gy]?.[gx]||0,checker=(gx+gy)%2;
    const last=surfaces.at(-1);
    if(last?.kind==='floor'&&last.z===z&&last.material===material&&last.checker===checker)last.far=far;
    else surfaces.push({kind:'floor',near,far,z,material,checker});
    if(side){y+=sy;nextY+=dy;}else{x+=sx;nextX+=dx;}
    const type=map.grid[Math.floor(y/scale)]?.[Math.floor(x/scale)]??1;
    if(type){
      const hit=side?px+far*rx:py+far*ry;
      surfaces.push({kind:'wall',near:far,low:0,high:2.7,type,side,tx:Math.floor((hit-Math.floor(hit))*64)});break;
    }
    const nextZ=map.heights[y]?.[x]||0;
    if(Math.abs(nextZ-z)>1e-6)surfaces.push({kind:'riser',near:far,low:Math.min(z,nextZ),high:Math.max(z,nextZ),side});
    near=far;
  }
  return surfaces;
}

export function drawTerrain(ctx,map,view,{w,h,fov,projection,horizon,eye,colStep,depths,zbuffer,wallTextures}){
  depths.fill(Infinity);zbuffer.fill(Infinity);
  const ca=Math.cos(view.angle),sa=Math.sin(view.angle);
  const floors=[tint(map.floor,1.03),'#c18746','#689b96',tint(map.light,.84),tint(map.light,.84)];
  for(let x=0;x<w;x+=colStep){
    const camera=2*x/w-1,rx=ca-sa*fov*camera,ry=sa+ca*fov*camera;
    const surfaces=terrainColumn(map,view.x,view.y,rx,ry);
    for(let i=surfaces.length-1;i>=0;i--){
      const s=surfaces[i],near=Math.max(.001,s.near),isFloor=s.kind==='floor';
      if(isFloor&&s.z>=eye)continue;
      const top=isFloor?horizon+projection*(eye-s.z)/Math.max(.001,s.far):horizon+projection*(eye-s.high)/near;
      const bottom=horizon+projection*(eye-(isFloor?s.z:s.low))/near;
      const start=Math.max(0,Math.ceil(top-.5)),end=Math.min(h,Math.ceil(bottom-.5));
      if(end<=start)continue;
      if(s.kind==='wall'){
        ctx.drawImage(wallTextures[s.type]||wallTextures[1],s.tx,(start-top)*64/(bottom-top),1,(end-start)*64/(bottom-top),x,start,colStep,end-start);
        for(let k=x;k<Math.min(w,x+colStep);k++)zbuffer[k]=near;
      }else{
        ctx.fillStyle=isFloor?floors[s.material]||floors[0]:s.side?'#94754e':'#ad8a5b';
        ctx.fillRect(x,start,colStep,end-start);
      }
      // Distance shading and alternating stone slabs make the tread edges legible.
      const distance=isFloor?(near+s.far)*.5:near;
      ctx.fillStyle=`rgba(12,20,20,${Math.min(.72,distance/48+(isFloor?s.checker*.045:s.side?.12:0))})`;
      ctx.fillRect(x,start,colStep,end-start);
      for(let y=start;y<end;y++){
        const depth=isFloor?projection*(eye-s.z)/(y+.5-horizon):near;
        for(let k=x;k<Math.min(w,x+colStep);k++)depths[y*w+k]=depth;
      }
    }
  }
}
