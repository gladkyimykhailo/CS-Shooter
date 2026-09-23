import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Canvas calls are counted, not rasterized: timings measure JavaScript work,
// not browser FPS. An optional root allows comparisons against a saved build.
const root=process.argv[2]||resolve(import.meta.dirname,'..');
const { MAPS, floorHeight, findPath }=await import(pathToFileURL(resolve(root,'public/core.js')));
const { drawTerrain }=await import(pathToFileURL(resolve(root,'public/terrain.js')));
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
let calls=0;
const ctx={fillRect(){calls++;},drawImage(){calls++;}};
const w=960,h=540,depths=new Float32Array(w*h),zbuffer=new Float32Array(w);
const scenes=MAPS.flatMap(map=>[map.blue[0],map.mid.point,map.red[0]].map(([x,y],i)=>({map,view:{x,y,angle:[.6,1.8,3.7][i]}})));
function terrain(){
  for(const {map,view} of scenes)drawTerrain(ctx,map,view,{w,h,fov:.78,projection:w/1.56,horizon:h*.48,
    eye:floorHeight(map,view.x,view.y)+.5,colStep:1,depths,zbuffer,wallTextures:[null,{}, {}, {}]});
}
const paths=MAPS.flatMap(map=>map.callouts.map(area=>({map,start:map.blue[0],end:area.point})));
function routing(){let steps=0;for(const {map,start,end} of paths)steps+=findPath(map,...start,...end).length;return steps;}
const cold=performance.now();const steps=routing();const coldMs=performance.now()-cold;
terrain();routing();
const renderSamples=[],pathSamples=[];let frameCalls;
for(let i=0;i<5;i++){
  calls=0;let start=performance.now();terrain();renderSamples.push((performance.now()-start)/scenes.length);frameCalls=calls/scenes.length;
  start=performance.now();routing();pathSamples.push(performance.now()-start);
}
console.log(JSON.stringify({terrain:{scenes:scenes.length,resolution:`${w}x${h}`,medianMsPerFrame:+median(renderSamples).toFixed(3),canvasCallsPerFrame:Math.round(frameCalls)},
  pathfinding:{routes:paths.length,totalSteps:steps,coldBatchMs:+coldMs.toFixed(3),medianWarmBatchMs:+median(pathSamples).toFixed(3)}},null,2));
