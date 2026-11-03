import * as THREE from 'three';
import { paintSurface } from './dom-surface.js';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const FINAL_DISTANCE = 13.5;

function createSurface() {
  const canvas = document.createElement('canvas');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return { canvas, texture, update(element, ratio) { if (paintSurface(element, canvas, ratio)) texture.needsUpdate = true; } };
}

// The same vertices form the orange ribbon and its information-bearing front.
// Only the final rectangle comes from layout; there is no second grid sliding in.
function makeRibbon(index, color) {
  const segments = 120, positions = [], uv = [], indices = [], frontIndices = [];
  const corners = [[-1,-1],[1,-1],[1,1],[-1,1]];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-10, (index-1)*1.8-1, -3),
    new THREE.Vector3(-4, Math.sin(index*1.8)*3.8, index-1),
    new THREE.Vector3(0, (index-1)*2.2, 1.5-index),
    new THREE.Vector3(4, Math.cos(index*1.4)*3.8, -1),
    new THREE.Vector3(10, (1-index)*3, -4)
  ]);
  for (let step=0;step<=segments;step++) {
    const t=step/segments, center=curve.getPoint(t), tangent=curve.getTangent(t);
    const normal=new THREE.Vector3(-tangent.y,tangent.x,0).normalize();
    const binormal=new THREE.Vector3().crossVectors(tangent,normal).normalize();
    const twist=Math.sin(t*Math.PI*2+index)*.6;
    const across=normal.clone().multiplyScalar(Math.cos(twist)).addScaledVector(binormal,Math.sin(twist));
    const depth=new THREE.Vector3().crossVectors(tangent,across).normalize();
    for(const [u,v] of corners){
      const p=center.clone().addScaledVector(across,u*.65).addScaledVector(depth,v*.07);
      positions.push(p.x,p.y,p.z);uv.push((u+1)/2,1-t);
    }
    if(step<segments) for(let side=0;side<4;side++){
      const a=step*4+side,b=step*4+(side+1)%4,c=a+4,d=b+4;
      indices.push(a,b,c,b,d,c);
      if(side===2)frontIndices.push(a,b,c,b,d,c);
    }
  }
  indices.push(0,2,1,0,3,2,segments*4,segments*4+1,segments*4+2,segments*4,segments*4+2,segments*4+3);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const initial=new Float32Array(positions), target=new Float32Array(positions.length);
  const surface=createSurface();
  const material=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.08,side:THREE.DoubleSide,transparent:true});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
  const faceGeometry=new THREE.BufferGeometry();
  faceGeometry.setAttribute('position',geometry.getAttribute('position'));
  faceGeometry.setAttribute('uv',geometry.getAttribute('uv'));faceGeometry.setIndex(frontIndices);
  const face=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({map:surface.texture,transparent:true,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false}));
  face.frustumCulled=false;face.renderOrder=1;
  let last=-1;
  return {mesh,face,surface,
    setTarget(rect,factor,width,height){
      for(let step=0;step<=segments;step++)for(let c=0;c<4;c++){
        const [u,v]=corners[c],offset=(step*4+c)*3;
        target[offset]=(rect.left+rect.width*(u+1)/2-width/2)*factor;
        target[offset+1]=(height/2-rect.top-rect.height*step/segments)*factor;
        target[offset+2]=v===1?0:-.14;
      }
      last=-1;
    },
    morph(value){
      if(Math.abs(value-last)<.00001)return;last=value;
      const buffer=geometry.getAttribute('position');
      for(let i=0;i<initial.length;i++)buffer.array[i]=THREE.MathUtils.lerp(initial[i],target[i],value);
      buffer.needsUpdate=true;geometry.computeVertexNormals();
    }
  };
}

function makeCard(){
  const group=new THREE.Group(),materials=[];
  for(let i=0;i<3;i++){
    const material=new THREE.MeshStandardMaterial({color:i===0?0xf4f3ee:i===1?0xff5c28:0x30332f,roughness:.8,transparent:true});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,.02),material);mesh.position.z=-i*.08;group.add(mesh);materials.push(material);
  }
  const surface=createSurface();
  const face=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:surface.texture,transparent:true,toneMapped:false}));
  face.position.z=.0105;group.add(face);
  return {group,materials,face,surface};
}

export function createWorld(canvas,root,getState){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,80);
  scene.add(new THREE.HemisphereLight(0xffffff,0x67604c,3.1));
  const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(-4,8,6);scene.add(light);
  const rim=new THREE.DirectionalLight(0xffc09d,2);rim.position.set(6,-2,1);scene.add(rim);
  const ribbons=new THREE.Group();scene.add(ribbons);
  const days=[0xff5b24,0xf04d19,0xff743d].map((color,index)=>makeRibbon(index,color));
  days.forEach(day=>{ribbons.add(day.mesh,day.face);});
  const card=makeCard();scene.add(card.group);
  const hero=root.querySelector('.flow-hero'),calendar=root.querySelector('[data-flight="calendar"]'),editor=root.querySelector('[data-flight="editor"]');
  const panels=[calendar,editor].map(node=>node.querySelector('[data-flight-panel]'));
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer={x:0,y:0},eased={x:0,y:0};
  let frame=0,disposed=false,lost=false,width=1,height=1,lastTime=0,layoutDirty=true,surfacesDirty=true,metrics;
  let dayNodes=[],cardNode,cardTarget,paintedCard;
  const factor=()=>2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*FINAL_DISTANCE/height;
  function relativeRect(node,stage){const r=node.getBoundingClientRect(),s=stage.getBoundingClientRect();return{left:r.left-s.left,top:r.top-s.top,width:r.width,height:r.height};}
  function measure(){
    metrics=[hero,calendar,editor].map(node=>({top:node.getBoundingClientRect().top+scrollY,height:node.offsetHeight}));
    dayNodes=[...calendar.querySelectorAll('.toy-day')];
    const calendarStage=calendar.querySelector('.flow-sticky-stage');
    dayNodes.forEach((node,i)=>days[i].setTarget(relativeRect(node,calendarStage),factor(),width,height));
    cardNode=editor.querySelector('.studio-live-card .event-card');
    if(cardNode){
      const rect=relativeRect(cardNode,editor.querySelector('.flow-sticky-stage')),f=factor();
      cardTarget={x:(rect.left+rect.width/2-width/2)*f,y:(height/2-rect.top-rect.height/2)*f,width:rect.width*f,height:rect.height*f};
    }
    layoutDirty=false;surfacesDirty=true;
  }
  function paint(){
    const ratio=Math.min(devicePixelRatio||1,1.65);
    dayNodes.forEach((node,i)=>days[i].surface.update(node,ratio));
    if(cardNode){card.surface.update(cardNode,ratio);paintedCard=cardNode;}
    surfacesDirty=false;
  }
  function phase(index){const m=metrics[index];return clamp((scrollY-m.top)/Math.max(1,m.height-height));}
  function resize(){width=innerWidth;height=innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<700?1.25:1.65));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();layoutDirty=true;invalidate();}
  function draw(time=0){
    frame=0;if(disposed||lost||document.hidden)return;
    const {paused}=getState(),reduced=media.matches||paused;
    root.dataset.motionPaused=String(paused);
    if(layoutDirty)measure();
    const currentCard=editor.querySelector('.studio-live-card .event-card');
    if(currentCard!==paintedCard){cardNode=currentCard;layoutDirty=true;measure();}
    if(surfacesDirty)paint();
    const p=phase(1),q=phase(2);
    calendar.style.setProperty('--flight-progress',String(p));editor.style.setProperty('--flight-progress',String(q));
    calendar.style.setProperty('--calendar-copy',String(smooth(.67,.94,p)));
    editor.style.setProperty('--editor-copy',String(smooth(.52,.9,q)));
    const calendarLive=reduced||width<760||p>=.999;
    const editorLive=reduced||width<1000||height<690||q>=.999;
    root.dataset.calendarLive=String(calendarLive);root.dataset.editorLive=String(editorLive);
    panels[0].inert=!calendarLive;panels[1].inert=!editorLive;
    let mode='none';
    if(scrollY<metrics[0].top+metrics[0].height)mode='hero';
    else if(!reduced&&width>=760&&!calendarLive&&scrollY<metrics[1].top+metrics[1].height)mode='calendar';
    else if(!reduced&&width>=1000&&height>=690&&!editorLive&&scrollY>=metrics[2].top-height&&scrollY<metrics[2].top+metrics[2].height)mode='editor';
    canvas.style.opacity=mode==='none'?'0':'1';root.dataset.camera=mode;
    // Let the next scene enter with its section, without drawing over the calendar.
    canvas.style.clipPath=mode==='editor'?`inset(${Math.max(0,metrics[2].top-scrollY)}px 0 0 0)`:'none';
    const dt=Math.min(.05,(time-lastTime)/1000||.016);lastTime=time;
    const damping=1-Math.exp(-dt*7),focus=root.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,select,button');
    eased.x+=((reduced||focus?0:pointer.x)-eased.x)*damping;eased.y+=((reduced||focus?0:pointer.y)-eased.y)*damping;
    ribbons.visible=mode==='hero'||mode==='calendar';card.group.visible=mode==='editor'&&Boolean(cardTarget);
    if(ribbons.visible){
      const morph=mode==='calendar'?smooth(.08,.96,p):0;
      ribbons.rotation.set(.12*(1-morph),-.18*(1-morph),-.19*(1-morph));
      ribbons.position.set(0,-1.3*(1-morph),0);ribbons.scale.setScalar(width<760?.63:1);
      for(const day of days){
        day.morph(morph);day.mesh.material.opacity=1-smooth(.87,.99,p)*(mode==='calendar'?1:0);
        day.face.material.opacity=mode==='calendar'?smooth(.23,.62,p):0;
      }
      const travel=mode==='calendar'?Math.sin(p*Math.PI):0,parallax=1-morph;
      camera.position.set(eased.x*.45*parallax+travel*1.8,eased.y*.3*parallax+travel*.6,mode==='hero'?(width<760?13:FINAL_DISTANCE):FINAL_DISTANCE-travel*4);
      camera.lookAt(mode==='calendar'?(.5*parallax*smooth(0,.3,p)):0,-.1*parallax,0);
    }
    if(card.group.visible){
      const move=smooth(.05,.97,q),explode=Math.sin(q*Math.PI);
      const aspect=cardTarget.height/cardTarget.width;
      card.group.position.set(THREE.MathUtils.lerp(-2,cardTarget.x,move),THREE.MathUtils.lerp(.1,cardTarget.y,move),-.0105);
      card.group.rotation.set(.12*(1-move),-.75*(1-move),-.16*(1-move));
      card.group.scale.set(THREE.MathUtils.lerp(4.1,cardTarget.width,move),THREE.MathUtils.lerp(4.1*aspect,cardTarget.height,move),1);
      for(let i=0;i<3;i++){card.group.children[i].position.z=-i*(.08+explode*.65);card.materials[i].opacity=1-smooth(.86,.98,q);}
      camera.position.set(1.3*(1-move),.3*(1-move),THREE.MathUtils.lerp(10.5,FINAL_DISTANCE,move));camera.lookAt(0,0,0);
    }
    if(mode!=='none')renderer.render(scene,camera);
    const settling=Math.abs(eased.x-(reduced||focus?0:pointer.x))+Math.abs(eased.y-(reduced||focus?0:pointer.y))>.002;
    if(mode!=='none'&&!reduced&&settling)frame=requestAnimationFrame(draw);
  }
  function invalidate(){if(!disposed&&!lost&&!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
  function refresh(){layoutDirty=true;surfacesDirty=true;invalidate();}
  function onPointer(event){pointer.x=(event.clientX/width-.5)*2;pointer.y=(.5-event.clientY/height)*2;invalidate();}
  function onVisibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;}else invalidate();}
  function onLost(event){event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;root.dataset.world='fallback';panels.forEach(panel=>{panel.inert=false;});}
  window.addEventListener('scroll',invalidate,{passive:true});window.addEventListener('resize',resize);window.addEventListener('pointermove',onPointer,{passive:true});
  document.addEventListener('visibilitychange',onVisibility);media.addEventListener('change',refresh);canvas.addEventListener('webglcontextlost',onLost);
  root.dataset.world='ready';resize();
  const observer=new ResizeObserver(refresh);observer.observe(root);panels.forEach(panel=>observer.observe(panel));
  document.fonts?.ready.then(()=>{if(!disposed)refresh();});
  return {invalidate:refresh,dispose(){
    disposed=true;cancelAnimationFrame(frame);observer.disconnect();
    window.removeEventListener('scroll',invalidate);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',onPointer);
    document.removeEventListener('visibilitychange',onVisibility);media.removeEventListener('change',refresh);canvas.removeEventListener('webglcontextlost',onLost);
    const geometries=new Set(),materials=new Set(),textures=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of [object.material].flat()){materials.add(material);if(material.map)textures.add(material.map);}});
    geometries.forEach(geometry=>geometry.dispose());textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());renderer.dispose();panels.forEach(panel=>{panel.inert=false;});
  }};
}
