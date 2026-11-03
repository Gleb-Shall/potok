import * as THREE from 'three';
import { paintSurface } from './dom-surface.js';

import { STORY, progress, smooth } from './story-time.js';
const FINAL_DISTANCE = 13.5;

function createSurface() {
  const canvas = document.createElement('canvas');
  const makeTexture = () => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
    return texture;
  };
  let texture = makeTexture();
  return { get texture() { return texture; }, update(element, ratio) {
    const width = canvas.width, height = canvas.height;
    if (paintSurface(element, canvas, ratio)) {
      // Uploaded textures have immutable storage; a new layout can need a new size.
      if (canvas.width !== width || canvas.height !== height) { texture.dispose(); texture = makeTexture(); }
      else texture.needsUpdate = true;
    }
    return texture;
  } };
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
  const loop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5, -2, -4), new THREE.Vector3(-1, 3.8, -2),
    new THREE.Vector3(4.8, 1.5, 1), new THREE.Vector3(2, -3.5, 2.5),
    new THREE.Vector3(-3.8, -.5, 1), new THREE.Vector3(-1, 3, -4),
    new THREE.Vector3(5, -.8, -3),
  ], true, 'catmullrom', .45);
  const center = new THREE.Vector3(), tangent = new THREE.Vector3(), across = new THREE.Vector3(), depth = new THREE.Vector3();
  const axes = ['x', 'y', 'z'];
  return {mesh,face,surface,
    setTarget(rect,factor,width,height){
      for(let step=0;step<=segments;step++)for(let c=0;c<4;c++){
        const [u,v]=corners[c],offset=(step*4+c)*3;
        target[offset]=(rect.left+rect.width*(u+1)/2-width/2)*factor;
        target[offset+1]=(height/2-rect.top-rect.height*step/segments)*factor;
        target[offset+2]=v===1?0:-.14;
      }
    },
    fly(p, pointer, drag){
      const launch = smooth(0, .24, p), land = smooth(.35, 1, p);
      const buffer = geometry.getAttribute('position');
      for (let step = 0; step <= segments; step++) {
        const t = step / segments, u = (t * .68 + p * 1.45 + index * .13) % 1;
        loop.getPoint(u, center); loop.getTangent(u, tangent);
        across.set(-tangent.y, tangent.x, 0).normalize();
        if (across.lengthSq() < .01) across.set(1, 0, 0);
        depth.crossVectors(tangent, across).normalize();
        const twist = Math.sin(u * Math.PI * 2 + p * 4 + index) * .9;
        const taper = 1 - smooth(.88, 1, t);
        for (let c = 0; c < 4; c++) {
          const [side, edge] = corners[c], offset = (step * 4 + c) * 3;
          const bend = Math.exp(-((initial[offset] - pointer.x * 6) ** 2 + (initial[offset + 1] - pointer.y * 4) ** 2) / 14) * (1 - launch);
          for (let axis = 0; axis < 3; axis++) {
            const key = axes[axis];
            const displacement = axis === 0 ? pointer.x * .8 + drag.x : axis === 1 ? pointer.y * 1.4 + drag.y : .8;
            const original = initial[offset + axis] + bend * displacement;
            const flying = center[key] + side * .65 * taper * (across[key] * Math.cos(twist) + depth[key] * Math.sin(twist)) + edge * .07 * (depth[key] * Math.cos(twist) - across[key] * Math.sin(twist));
            buffer.array[offset + axis] = THREE.MathUtils.lerp(THREE.MathUtils.lerp(original, flying, launch), target[offset + axis], land);
          }
        }
      }
      buffer.needsUpdate=true;geometry.computeVertexNormals();
    }
  };
}

function makePanel() {
  const group = new THREE.Group();
  const source = createSurface(), destination = createSurface();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: source.texture, transparent: true, toneMapped: false,
  }));
  const back = new THREE.Mesh(front.geometry, new THREE.MeshBasicMaterial({
    map: destination.texture, transparent: true, toneMapped: false,
  }));
  front.position.z = .001; back.position.z = -.001; back.rotation.y = Math.PI;
  group.add(front, back);
  return { group, source, destination, front, back };
}

export function createWorld(canvas, root, getState) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 80);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x67604c, 3.1));
  const light = new THREE.DirectionalLight(0xffffff, 4); light.position.set(-4, 8, 6); scene.add(light);
  const rim = new THREE.DirectionalLight(0xffc09d, 2); rim.position.set(6, -2, 1); scene.add(rim);
  const ribbons = new THREE.Group(); scene.add(ribbons);
  const days = [0xff5b24, 0xf04d19, 0xff743d].map((color, index) => makeRibbon(index, color));
  days.forEach(day => ribbons.add(day.mesh, day.face));
  const panels3d = Array.from({ length: 3 }, makePanel);
  panels3d.forEach(panel => scene.add(panel.group));

  const hero = root.querySelector('.flow-hero'), story = root.querySelector('.flow-story');
  const stage = root.querySelector('.flow-story-stage');
  const flights = [...root.querySelectorAll('[data-flight]')];
  const panels = flights.map(node => node.querySelector('[data-flight-panel]'));
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0 }, eased = { x: 0, y: 0 };
  const drag = { active: false, x: 0, y: 0, targetX: 0, targetY: 0, startX: 0, startY: 0 };
  let frame = 0, disposed = false, lost = false, width = 1, height = 1, lastTime = 0;
  let layoutDirty = true, surfacesDirty = true, storyTop = 0, enhanced = false, texturePhase = '';
  let animatedScroll = scrollY;
  let dayNodes = [], calendarNodes = [], editorNodes = [], recordNodes = [];
  let calendarRects = [], editorRects = [], recordRects = [];

  const factor = () => 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * FINAL_DISTANCE / height;
  const rect = node => {
    const r = node.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
  };
  function measure() {
    storyTop = story.getBoundingClientRect().top + scrollY;
    dayNodes = [...panels[0].querySelectorAll('.toy-day')];
    dayNodes.forEach((node, i) => days[i].setTarget(rect(node), factor(), width, height));
    const cards = [...panels[0].querySelectorAll('.toy-event')];
    const selected = cards.find(node => node.dataset.cardId === getState().event?.id) || cards[1];
    const others = cards.filter(node => node !== selected);
    calendarNodes = [others[0], selected, others[1]].filter(Boolean);
    editorNodes = [panels[1].querySelector('.studio-form'), panels[1].querySelector('.studio-live-card .event-card'), panels[1].querySelector('.studio-orbit')];
    recordNodes = [panels[2].querySelector('.network-source'), ...panels[2].querySelectorAll('.network-event')];
    calendarRects = calendarNodes.map(rect); editorRects = editorNodes.map(rect); recordRects = recordNodes.map(rect);
    layoutDirty = false; surfacesDirty = true;
  }
  function paint(phase) {
    const ratio = Math.min(devicePixelRatio || 1, 1.65);
    if (phase === 'entry' || phase === 'hero') dayNodes.forEach((node, i) => { days[i].face.material.map = days[i].surface.update(node, ratio); });
    if (phase === 'calendar-editor') panels3d.forEach((panel, i) => {
      panel.front.material.map = panel.source.update(calendarNodes[i], ratio);
      panel.back.material.map = panel.destination.update(editorNodes[i], ratio);
    });
    if (phase === 'editor-records') panels3d.forEach((panel, i) => {
      panel.front.material.map = panel.source.update(editorNodes[i], ratio);
      panel.back.material.map = panel.destination.update(recordNodes[i], ratio);
    });
    texturePhase = phase; surfacesDirty = false;
  }
  function bridge(t, outgoing, incoming) {
    const gather = smooth(0, .43, t), spread = smooth(.43, 1, t);
    const f = factor();
    panels3d.forEach((panel, i) => {
      const start = outgoing[i], end = incoming[i];
      const midWidth = width * .24;
      // Change proportions while the panel is edge-on, not while its text is readable.
      const midHeight = midWidth * THREE.MathUtils.lerp(start.height / start.width, end.height / end.width, smooth(.45, .62, t));
      const mid = { left: width * (.08 + i * .30), top: height * .52 - midHeight / 2, width: midWidth, height: midHeight };
      const box = {};
      for (const key of ['left', 'top', 'width', 'height']) {
        box[key] = t < .43 ? THREE.MathUtils.lerp(start[key], mid[key], gather) : THREE.MathUtils.lerp(mid[key], end[key], spread);
      }
      const turn = smooth(.34 + i * .025, .68 + i * .025, t);
      const arc = Math.sin(t * Math.PI);
      panel.group.position.set((box.left + box.width / 2 - width / 2) * f,
        (height / 2 - box.top - box.height / 2) * f + Math.sin(i * 1.9) * arc * .28,
        -.001 + arc * (i === 1 ? .35 : -.18));
      panel.group.scale.set(box.width * f, box.height * f, 1);
      panel.group.rotation.set(arc * (i - 1) * .1, Math.PI * turn, arc * (i - 1) * -.075);
      panel.front.material.opacity = 1; panel.back.material.opacity = 1;
      panel.group.position.z -= i === 2 ? smooth(.6, 1, t) * .006 : 0;
      panel.group.visible = true;
    });
    camera.position.set(Math.sin(t * Math.PI) * .45, 0, FINAL_DISTANCE - Math.sin(t * Math.PI) * .35);
    camera.lookAt(0, 0, 0);
  }
  function resize() {
    width = innerWidth; height = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 700 ? 1.25 : 1.65));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    layoutDirty = true; invalidate();
  }
  function draw(time = 0) {
    frame = 0; if (disposed || lost || document.hidden) return;
    const { paused } = getState(), reduced = media.matches || paused;
    root.dataset.motionPaused = String(paused);
    const active = !reduced && width >= 1000 && height >= 690;
    if (active !== enhanced) {
      enhanced = active; root.dataset.storyReady = String(active); layoutDirty = true; animatedScroll = scrollY;
    }
    if (layoutDirty) measure();
    const dt = Math.min(.05, (time - lastTime) / 1000 || .016); lastTime = time;
    animatedScroll += (scrollY - animatedScroll) * (reduced ? 1 : 1 - Math.exp(-dt * 18));
    if (Math.abs(scrollY - animatedScroll) < .08) animatedScroll = scrollY;
    const s = (animatedScroll - storyTop) / height;
    let mode = 'none';
    if (enhanced && s >= STORY.entryStart && s < STORY.calendarIn) mode = 'entry';
    else if (s < 0) mode = 'hero';
    else if (enhanced && s > STORY.calendarOut && s < STORY.editorIn) mode = 'calendar-editor';
    else if (enhanced && s > STORY.editorOut && s < STORY.recordsIn) mode = 'editor-records';
    const calendarLive = !enhanced || s >= STORY.calendarIn && s <= STORY.calendarOut;
    const editorLive = !enhanced || s >= STORY.editorIn && s <= STORY.editorOut;
    const recordsLive = !enhanced || s >= STORY.recordsIn;
    root.dataset.calendarLive = String(calendarLive); root.dataset.editorLive = String(editorLive); root.dataset.recordsLive = String(recordsLive);
    root.dataset.calendarMotion = mode === 'entry' || mode === 'hero' ? 'entry' : mode === 'calendar-editor' ? 'exit' : 'idle';
    const live = [calendarLive, editorLive, recordsLive];
    const show = [!enhanced || s < STORY.editorIn, !enhanced || s >= STORY.calendarOut && s < STORY.recordsIn, !enhanced || s >= STORY.editorOut];
    flights.forEach((node, i) => { node.style.visibility = show[i] ? 'visible' : 'hidden'; panels[i].inert = !live[i]; });
    const p = progress(STORY.entryStart, STORY.calendarIn, s);
    const ce = progress(STORY.calendarOut, STORY.editorIn, s);
    const er = progress(STORY.editorOut, STORY.recordsIn, s);
    story.style.setProperty('--calendar-copy', String(smooth(.91, .99, p) * (1 - smooth(0, .2, ce))));
    story.style.setProperty('--calendar-shell', String(1 - smooth(0, .28, ce)));
    story.style.setProperty('--editor-copy', String(smooth(.83, .99, ce) * (1 - smooth(0, .2, er))));
    story.style.setProperty('--records-copy', String(smooth(.83, .99, er)));
    root.style.setProperty('--hero-copy', String(enhanced ? 1 - smooth(STORY.entryStart, .04, s) : 1));
    const wipe = (from, to, value) => {
      if (value <= 0) return from;
      if (value >= 1) return to;
      const edge = value * 140 - 20;
      return 'linear-gradient(115deg,' + to + ' ' + edge + '%,' + from + ' ' + (edge + .1) + '%)'; // taste-skill-ignore: a moving hard edge between two flat fields, without a colour blend.
    };
    story.style.setProperty('--story-paper', er > 0 ? wipe('#1c211b', '#f4f4ef', smooth(.12, .8, er)) : wipe('#f4f4ef', '#1c211b', smooth(.12, .8, ce)));

    const damping = 1 - Math.exp(-dt * 7);
    eased.x += ((reduced ? 0 : pointer.x) - eased.x) * damping;
    eased.y += ((reduced ? 0 : pointer.y) - eased.y) * damping;
    drag.x += ((reduced ? 0 : drag.targetX) - drag.x) * damping;
    drag.y += ((reduced ? 0 : drag.targetY) - drag.y) * damping;
    ribbons.visible = mode === 'hero' || mode === 'entry';
    panels3d.forEach(panel => { panel.group.visible = false; });
    if (mode !== 'none' && (surfacesDirty || texturePhase !== mode)) paint(mode);
    if (ribbons.visible) {
      const morph = mode === 'entry' ? smooth(.35, 1, p) : 0;
      const travel = mode === 'entry' ? Math.sin(Math.PI * p) : 0;
      ribbons.position.set(0, -1.3 * (1 - morph), 0);
      ribbons.rotation.set((.12 + eased.y * .13) * (1 - morph), (-.18 + eased.x * .22) * (1 - morph), (-.19 + drag.x * .035) * (1 - morph));
      ribbons.scale.setScalar(width < 760 ? .63 : 1);
      days.forEach(day => {
        day.fly(mode === 'entry' ? p : 0, eased, drag);
        day.face.material.opacity = mode === 'entry' ? smooth(.975, .995, p) : 0;
        day.mesh.material.opacity = mode === 'entry' ? 1 - smooth(.975, .995, p) : 1;
      });
      camera.position.set(eased.x * .7 * (1 - morph), eased.y * .5 * (1 - morph),
        (width < 760 ? 13 : FINAL_DISTANCE) - travel * 1.7);
      camera.lookAt(0, -.1 * (1 - morph), 0);
    }
    if (mode === 'calendar-editor') bridge(ce, calendarRects, editorRects, mode);
    if (mode === 'editor-records') bridge(er, editorRects, recordRects, mode);
    canvas.style.opacity = mode === 'none' ? '0' : '1'; root.dataset.camera = mode;
    canvas.style.clipPath = 'none';
    if (mode !== 'none') renderer.render(scene, camera);
    const settling = Math.abs(eased.x - (reduced ? 0 : pointer.x)) + Math.abs(eased.y - (reduced ? 0 : pointer.y)) + Math.abs(drag.x - drag.targetX) + Math.abs(drag.y - drag.targetY) > .002;
    if (!reduced && (Math.abs(scrollY - animatedScroll) > .08 || (mode === 'hero' || mode === 'entry') && settling)) frame = requestAnimationFrame(draw);
  }
  function invalidate() { if (!disposed && !lost && !frame && !document.hidden) frame = requestAnimationFrame(draw); }
  function refresh() { layoutDirty = true; surfacesDirty = true; invalidate(); }
  function onPointer(event) {
    pointer.x = (event.clientX / width - .5) * 2; pointer.y = (.5 - event.clientY / height) * 2;
    if (drag.active) { drag.targetX = (event.clientX - drag.startX) / width * 6; drag.targetY = (drag.startY - event.clientY) / height * 5; }
    invalidate();
  }
  function onGrab(event) {
    if (event.pointerType !== 'mouse' || event.target.closest('a,button,input')) return;
    drag.active = true; drag.startX = event.clientX; drag.startY = event.clientY;
    hero.setPointerCapture(event.pointerId); hero.dataset.dragging = 'true';
  }
  function onRelease() { drag.active = false; drag.targetX = 0; drag.targetY = 0; hero.dataset.dragging = 'false'; invalidate(); }
  function onVisibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else invalidate(); }
  function restorePanels() {
    root.dataset.storyReady = 'false';
    flights.forEach(node => { node.style.visibility = ''; });
    panels.forEach(panel => { panel.inert = false; });
  }
  function onLost(event) { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; root.dataset.world = 'fallback'; restorePanels(); }
  window.addEventListener('scroll', invalidate, { passive: true }); window.addEventListener('resize', resize); window.addEventListener('pointermove', onPointer, { passive: true });
  root.addEventListener('input', refresh); root.addEventListener('click', refresh);
  hero.addEventListener('pointerdown', onGrab); hero.addEventListener('pointerup', onRelease); hero.addEventListener('pointercancel', onRelease); hero.addEventListener('lostpointercapture', onRelease);
  document.addEventListener('visibilitychange', onVisibility); media.addEventListener('change', refresh); canvas.addEventListener('webglcontextlost', onLost);
  root.dataset.world = 'ready'; resize();
  const observer = new ResizeObserver(refresh); observer.observe(root); panels.forEach(panel => observer.observe(panel));
  document.fonts?.ready.then(() => { if (!disposed) refresh(); });
  return { invalidate: refresh, dispose() {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    window.removeEventListener('scroll', invalidate); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onPointer);
    root.removeEventListener('input', refresh); root.removeEventListener('click', refresh);
    hero.removeEventListener('pointerdown', onGrab); hero.removeEventListener('pointerup', onRelease); hero.removeEventListener('pointercancel', onRelease); hero.removeEventListener('lostpointercapture', onRelease);
    document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener('change', refresh); canvas.removeEventListener('webglcontextlost', onLost);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? [object.material].flat() : []) { materials.add(material); if (material.map) textures.add(material.map); }
    });
    geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); renderer.dispose(); restorePanels();
  } };
}
