import * as THREE from 'three';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };

// A closed rectangular ribbon, with a second shape that unfolds into a day plane.
function ribbonGeometry(index) {
  const segments = 120, positions = [], unfolded = [], indices = [];
  const corners = [[-1,-1],[1,-1],[1,1],[-1,1]];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-10, (index - 1) * 1.8 - 1, -3),
    new THREE.Vector3(-4, Math.sin(index * 1.8) * 3.8, index - 1),
    new THREE.Vector3(0, (index - 1) * 2.2, 1.5 - index),
    new THREE.Vector3(4, Math.cos(index * 1.4) * 3.8, -1),
    new THREE.Vector3(10, (1 - index) * 3, -4)
  ]);
  for (let step = 0; step <= segments; step++) {
    const t = step / segments;
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const twist = Math.sin(t * Math.PI * 2 + index) * .6;
    const width = normal.clone().multiplyScalar(Math.cos(twist)).addScaledVector(binormal, Math.sin(twist));
    const depth = new THREE.Vector3().crossVectors(tangent, width).normalize();
    for (const [u,v] of corners) {
      const p = center.clone().addScaledVector(width, u * .65).addScaledVector(depth, v * .07);
      positions.push(p.x,p.y,p.z);
      unfolded.push((index-1)*3.2 + u*1.32, 3.1 - t*6.2, v*.07);
    }
    if (step < segments) for (let side = 0; side < 4; side++) {
      const a=step*4+side, b=step*4+(side+1)%4, c=a+4, d=b+4;
      indices.push(a,b,c,b,d,c);
    }
  }
  indices.push(0,2,1,0,3,2, segments*4,segments*4+1,segments*4+2,segments*4,segments*4+2,segments*4+3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const target = geometry.clone();
  target.setAttribute('position',new THREE.Float32BufferAttribute(unfolded,3));
  target.computeVertexNormals();
  geometry.morphAttributes.position=[target.getAttribute('position').clone()];
  geometry.morphAttributes.normal=[target.getAttribute('normal').clone()];
  target.dispose();
  return geometry;
}

function makeCard() {
  const group=new THREE.Group();
  const materials=[];
  for (let i=0;i<3;i++) {
    const material=new THREE.MeshStandardMaterial({color: i===0?0xf4f3ee:i===1?0xff5c28:0x30332f,roughness:.8,metalness:0,transparent:true});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(4.1,2.8,.085),material);
    mesh.position.z=-i*.17;
    group.add(mesh);materials.push(material);
  }
  const surface=document.createElement('canvas');surface.width=1024;surface.height=700;
  const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(3.98,2.68),new THREE.MeshBasicMaterial({map:texture,transparent:true}));
  face.position.z=.05;group.add(face);
  let signature='';
  function update(event) {
    const next=JSON.stringify([event?.title,event?.start,event?.duration,event?.color]);
    if (signature===next) return;
    signature=next;
    const context=surface.getContext('2d');
    context.fillStyle=({violet:'#ffeddf',blue:'#e4edf0',green:'#e2ead4',peach:'#f6ddc6',pink:'#eddee4'})[event?.color]||'#f4f3ee';context.fillRect(0,0,1024,700);
    context.fillStyle='#171a17';context.font='36px Jost, sans-serif';
    const time=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
    context.fillText(`${time(event?.start??900)} — ${time((event?.start??900)+(event?.duration??60))}`,68,110);
    context.font='500 70px Jost, sans-serif';
    const words=(event?.title||'Занятие с Анной').split(' ');let line='',row=0;
    for(const word of words){const text=line?`${line} ${word}`:word;if(context.measureText(text).width>850&&line){context.fillText(line,65,270+row*90);row++;line=word;}else line=text;}
    context.fillText(line,65,270+Math.min(row,2)*90);
    context.fillStyle='#fb5b26';context.fillRect(68,555,95,12);
    context.fillStyle='#656962';context.font='34px Jost, sans-serif';context.fillText('Время для твоих планов',68,625);
    texture.needsUpdate=true;
  }
  return {group,materials,face,update};
}

export function createWorld(canvas, root, getState) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(40,1,.1,80);
  const hemisphere=new THREE.HemisphereLight(0xffffff,0x67604c,3.1);scene.add(hemisphere);
  const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(-4,8,6);scene.add(light);
  const rim=new THREE.DirectionalLight(0xffc09d,2);rim.position.set(6,-2,1);scene.add(rim);
  const ribbons=new THREE.Group();scene.add(ribbons);
  const colors=[0xff5b24,0xf04d19,0xff743d];
  for(let i=0;i<3;i++) ribbons.add(new THREE.Mesh(ribbonGeometry(i),new THREE.MeshStandardMaterial({color:colors[i],roughness:.65,metalness:.08,side:THREE.DoubleSide,transparent:true})));
  const card=makeCard();scene.add(card.group);
  const hero=root.querySelector('.flow-hero');
  const calendar=root.querySelector('[data-flight="calendar"]');
  const editor=root.querySelector('[data-flight="editor"]');
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer={x:0,y:0}, eased={x:0,y:0};
  let frame=0, disposed=false, lost=false, width=1,height=1, lastTime=0;
  let layoutDirty=true, metrics;
  const panels=[calendar,editor].map(node=>node?.querySelector('[data-flight-panel]'));
  function resize(){width=window.innerWidth;height=window.innerHeight;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,width<700?1.25:1.65));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();layoutDirty=true;invalidate();}
  function measure(){metrics=[hero,calendar,editor].map(node=>({top:node.getBoundingClientRect().top+window.scrollY,height:node.offsetHeight}));layoutDirty=false;}
  function phase(index){const m=metrics[index];return clamp((window.scrollY-m.top)/Math.max(1,m.height-height));}
  function draw(time=0){
    frame=0;if(disposed||lost||document.hidden)return;
    if(layoutDirty)measure();
    const {paused,event}=getState();
    const reduced=media.matches||paused;
    root.dataset.motionPaused=String(paused);
    const y=window.scrollY;
    const p=phase(1), q=phase(2);
    calendar.style.setProperty('--flight-progress',String(p));
    editor.style.setProperty('--flight-progress',String(q));
    calendar.style.setProperty('--calendar-reveal',String(smooth(.64,.98,p)));
    editor.style.setProperty('--editor-reveal',String(smooth(.64,.97,q)));
    const calendarOpen=reduced||width<760||p>.94;
    const editorOpen=reduced||width<1000||height<690||q>.93;
    panels[0].inert=!calendarOpen;panels[1].inert=!editorOpen;
    calendar.dataset.settled=String(calendarOpen);editor.dataset.settled=String(editorOpen);
    let mode='none';
    if(y<metrics[0].top+metrics[0].height)mode='hero';
    else if(!reduced&&width>=760&&p<.995&&y<metrics[1].top+metrics[1].height)mode='calendar';
    else if(!reduced&&width>=1000&&height>=690&&y>=metrics[2].top-height*.4&&y<metrics[2].top+metrics[2].height)mode='editor';
    canvas.style.opacity=mode==='none'?'0':'1';
    root.dataset.camera=mode;
    const dt=Math.min(.05,(time-lastTime)/1000||.016);lastTime=time;
    const damping=1-Math.exp(-dt*7);
    const focus=root.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,select,button');
    eased.x+=((reduced||paused||focus?0:pointer.x)-eased.x)*damping;
    eased.y+=((reduced||paused||focus?0:pointer.y)-eased.y)*damping;
    ribbons.visible=mode==='hero'||mode==='calendar';card.group.visible=mode==='editor';
    if(ribbons.visible){
      const morph=mode==='calendar'?smooth(.15,.87,p):0;
      ribbons.rotation.set(.12*(1-morph),-.18*(1-morph),-.19*(1-morph));
      ribbons.position.set(0,mode==='hero'?-1.3:0,0);
      ribbons.scale.setScalar(width<760?.63:1);
      for(const mesh of ribbons.children){mesh.morphTargetInfluences[0]=morph;mesh.material.opacity=mode==='calendar'?1-smooth(.7,.98,p):1;}
      const travel=mode==='calendar'?Math.sin(p*Math.PI):0;
      camera.position.set(eased.x*.45+travel*1.8,eased.y*.3+travel*.6,mode==='hero'?(width<760?13:13.5):13.5-travel*4);
      camera.lookAt(mode==='hero'?0:(1-morph)*.5,mode==='hero'?-.1:0,0);
    }
    if(card.group.visible){
      card.update(event);
      const reveal=smooth(.15,.8,q), fade=1-smooth(.67,.94,q);
      card.group.rotation.set(.12*(1-reveal),-.75*(1-reveal),-.16*(1-reveal));
      card.group.position.set((1-reveal)*-2+reveal*2.7,.1,0);
      for(let i=0;i<3;i++){card.group.children[i].position.z=-i*(.17+Math.sin(q*Math.PI)*.85);card.materials[i].opacity=fade;}
      card.face.material.opacity=fade;
      camera.position.set((1-reveal)*1.3, .3*(1-reveal), 10.5-reveal*1.8);
      camera.lookAt(0,0,0);
    }
    if(mode!=='none')renderer.render(scene,camera);
    const settling=Math.abs(eased.x-(paused||focus?0:pointer.x))+Math.abs(eased.y-(paused||focus?0:pointer.y))>.002;
    if(mode!=='none'&&!reduced&&settling)frame=requestAnimationFrame(draw);
  }
  function invalidate(){if(!disposed&&!lost&&!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
  function onScroll(){invalidate();}
  function onPointer(event){pointer.x=(event.clientX/width-.5)*2;pointer.y=(.5-event.clientY/height)*2;invalidate();}
  function onVisibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;}else invalidate();}
  function onLost(event){event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;root.dataset.world='fallback';panels.forEach(panel=>{panel.inert=false;});}
  function onMedia(){layoutDirty=true;invalidate();}
  window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',resize);window.addEventListener('pointermove',onPointer,{passive:true});
  document.addEventListener('visibilitychange',onVisibility);media.addEventListener('change',onMedia);canvas.addEventListener('webglcontextlost',onLost);
  root.dataset.world='ready';resize();
  const observer=new ResizeObserver(()=>{layoutDirty=true;invalidate();});observer.observe(root);
  document.fonts?.ready.then(()=>{if(!disposed){card.update(undefined);card.update(getState().event);invalidate();}});
  return {invalidate,dispose(){
    disposed=true;cancelAnimationFrame(frame);observer.disconnect();
    window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',onPointer);
    document.removeEventListener('visibilitychange',onVisibility);media.removeEventListener('change',onMedia);canvas.removeEventListener('webglcontextlost',onLost);
    const geometries=new Set(),materials=new Set(),textures=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of [object.material].flat()){materials.add(material);if(material.map)textures.add(material.map);}});
    geometries.forEach(geometry=>geometry.dispose());textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());renderer.dispose();
    panels.forEach(panel=>{panel.inert=false;});
  }};
}
