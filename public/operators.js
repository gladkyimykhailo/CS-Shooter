import { actorHeight } from './core.js';
import { tint } from './art.js';

// Local coordinates: X points along the weapon, Y across the shoulders, Z up.
// Every part is a closed solid, including its back, sides and underside.
export function operatorParts(a,time=0,motion=true){
  const stride=motion&&a.moving?Math.sin(time*10)*.055:0;
  const parts=[];
  const box=(x,y,z,dx,dy,dz,material,head=false)=>parts.push({x,y,z,dx,dy,dz,material,head});
  for(const side of [-1,1]){
    const step=side*stride;
    box(step,side*.09,.16,.13,.13,.25,'uniform');
    box(step+.025,side*.09,.045,.20,.14,.09,'boot');
    box(step*.45,side*.09,.345,.15,.15,.19,'uniform');
    box(.078+step,side*.09,.22,.055,.105,.10,'armor');
    box(.01,side*.225,.665,.17,.13,.24,'uniform');
    box(.12,side*.205,.56,.25,.115,.12,'uniform');
    box(.23,side*.17,.565,.10,.11,.10,'glove');
    box(.015,side*.293,.705,.10,.012,.045,'accent');
  }
  box(0,0,.45,.23,.33,.12,'boot');
  box(0,0,.655,.235,.35,.31,'uniform');
  box(.125,0,.66,.07,.29,.245,'armor');
  box(-.15,0,.65,.12,.28,.25,'pack');
  for(const side of [-1,0,1])box(.17,side*.087,.59,.055,.074,.085,'pack');
  box(.168,0,.738,.008,.17,.028,'accent');
  box(0,0,.825,.12,.13,.06,'boot');
  box(.015,0,.918,.235,.225,.18,'helmet',true);
  box(0,0,1.015,.25,.255,.07,'helmet',true);
  box(.138,0,.952,.025,.20,.065,'visor',true);
  box(.143,0,.888,.035,.17,.06,'boot',true);
  box(-.015,-.14,.92,.115,.045,.115,'boot',true);
  const pistol=a.weapon==='pistol',long=['sniper','marksman'].includes(a.weapon);
  box(.24,.09,.60,.15,.075,.085,'gun');
  box(.34,.09,.66,pistol?.22:.38,.07,.075,'gun');
  if(!pistol){box(.33,.09,.595,.065,.06,.13,'gun');box(.40,.09,.71,.19,.035,.035,'gun');}
  box(pistol?.46:long?.72:.62,.09,.66,pistol?.045:long?.35:.19,.035,.035,'gun');
  if(a.flash>0)box(pistol?.50:long?.91:.73,.09,.66,.08,.075,.075,'flash');
  return parts;
}

// Ray/box intersection uses the same articulated solids that are drawn.
export function hitOperator(map,a,origin,direction,time=0,motion=true){
  const ca=Math.cos(a.angle),sa=Math.sin(a.angle),dx=origin.x-a.x,dy=origin.y-a.y;
  const o=[dx*ca+dy*sa,-dx*sa+dy*ca,origin.z-actorHeight(map,a)];
  const d=[direction.x*ca+direction.y*sa,-direction.x*sa+direction.y*ca,direction.z];
  let hit=null;
  for(const p of operatorParts(a,time,motion)){
    if(p.material==='gun'||p.material==='flash')continue;
    let near=0,far=Infinity;
    const centers=[p.x,p.y,p.z],sizes=[p.dx,p.dy,p.dz];
    for(let axis=0;axis<3;axis++){
      const lo=centers[axis]-sizes[axis]/2,hi=centers[axis]+sizes[axis]/2;
      if(Math.abs(d[axis])<1e-9){if(o[axis]<lo||o[axis]>hi){far=-1;break;}continue;}
      const t1=(lo-o[axis])/d[axis],t2=(hi-o[axis])/d[axis];
      near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
    }
    if(far>=near&&(!hit||near<hit.distance))hit={distance:near,head:p.head};
  }
  return hit;
}

function clipOperatorFace(points){
  const result=[],near=.045;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],inside=a[2]>=near;
    if(inside)result.push(a);
    if(inside!==(b[2]>=near)){
      const t=(near-a[2])/(b[2]-a[2]);
      result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,near]);
    }
  }
  return result;
}

// Scan-convert convex faces with perspective-correct depth. The shared depth
// buffer handles walls, stair treads, individual limbs and other operators.
function rasterOperatorFace(ctx,points,color,{w,h,projection,horizon,depths}){
  const clipped=clipOperatorFace(points);
  if(clipped.length<3)return;
  const screen=clipped.map(([x,z,d])=>[w*.5+x*projection/d,horizon-z*projection/d,1/d]);
  const top=Math.max(0,Math.ceil(Math.min(...screen.map(p=>p[1]))-.5));
  const bottom=Math.min(h,Math.ceil(Math.max(...screen.map(p=>p[1]))-.5));
  ctx.fillStyle=color;
  for(let y=top;y<bottom;y++){
    const intersections=[];
    for(let i=0;i<screen.length;i++){
      const a=screen[i],b=screen[(i+1)%screen.length];
      if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5)){
        const t=(y+.5-a[1])/(b[1]-a[1]);intersections.push([a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t]);
      }
    }
    if(intersections.length<2)continue;
    intersections.sort((a,b)=>a[0]-b[0]);
    const left=intersections[0],right=intersections.at(-1),span=right[0]-left[0];
    if(span<1e-9)continue;
    const start=Math.max(0,Math.ceil(left[0]-.5)),end=Math.min(w,Math.ceil(right[0]-.5));
    let run=-1;
    for(let x=start;x<=end;x++){
      const depth=1/(left[1]+(right[1]-left[1])*(x+.5-left[0])/span),index=y*w+x;
      const visible=x<end&&depth<depths[index];
      if(visible){depths[index]=depth;if(run<0)run=x;}
      else if(run>=0){ctx.fillRect(run,y,x-run,1);run=-1;}
    }
  }
}

export function drawOperators(ctx,map,actors,view,options){
  const {w,h,projection,horizon,eye,depths,time=0,motion=true,skin='#597464',glove='#333b37'}=options;
  const ca=Math.cos(view.angle),sa=Math.sin(view.angle);
  const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];
  const signs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const labels=[];
  for(const a of actors){
    if(a===view||a.hp<=0)continue;
    const dx=a.x-view.x,dy=a.y-view.y,depth=dx*ca+dy*sa,side=-dx*sa+dy*ca;
    if(depth<-.9||Math.abs(side)>Math.max(0,depth)*w/(2*projection)+1)continue;
    const z=actorHeight(map,a),ac=Math.cos(a.angle),as=Math.sin(a.angle);
    const palette={uniform:a.team===0?skin:'#aa7853',accent:a.team===0?'#c3f66b':'#ffbd73',helmet:a.team===0?skin:'#85644b',armor:'#303c38',pack:'#485249',boot:'#202925',visor:'#80b7bd',glove,gun:'#343d3e',flash:'#ffeaa0'};
    for(const p of operatorParts(a,time,motion)){
      const vertices=signs.map(([sx,sy,sz])=>{
        const lx=p.x+sx*p.dx/2,ly=p.y+sy*p.dy/2;
        const wx=dx+lx*ac-ly*as,wy=dy+lx*as+ly*ac;
        return [-wx*sa+wy*ca,z+p.z+sz*p.dz/2-eye,wx*ca+wy*sa];
      });
      for(let f=0;f<faces.length;f++){
        const points=faces[f].map(i=>vertices[i]);
        const u=points[1].map((v,i)=>v-points[0][i]),v=points[2].map((n,i)=>n-points[0][i]);
        const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        // Cull outward faces pointing away from the eye.
        if(normal.reduce((sum,n,i)=>sum+n*points[0][i],0)>=0)continue;
        const light=[.48,1.14,.72,.90,.60,1.02][f]*Math.max(.48,1-Math.max(0,depth)/55);
        rasterOperatorFace(ctx,points,p.material==='flash'?palette.flash:tint(palette[p.material],light),options);
      }
    }
    if(depth>.1)labels.push({a,depth,x:w*.5+side*projection/depth,y:horizon-(z+1.12-eye)*projection/depth,bodyY:horizon-(z+.7-eye)*projection/depth});
  }
  return labels;
}
