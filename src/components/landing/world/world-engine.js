import * as THREE from 'three';
import { paintSurface } from './dom-surface.js';
import { renderPixelRatio, texturePixelRatio } from './render-quality.js';
import { readAnimationQuality, APPEARANCE_CHANGE, ANIMATION_QUALITY_KEY } from '../../../lib/appearance.js';

import { STORY, MOBILE_STORY, progress, smooth } from './story-time.js';
import { createRibbonCurve, createFlightRoute } from './ribbon-flight.js';
const FINAL_DISTANCE = 13.5;

function createSurface() {
  const canvas = document.createElement('canvas');
  const makeTexture = () => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
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
  const segments = innerWidth < 760 ? 72 : 120, positions = [], uv = [], indices = [], frontIndices = [];
  const corners = [[-1,-1],[1,-1],[1,1],[-1,1]];
  const curve = createRibbonCurve(index);
  for (let step=0;step<=segments;step++) {
    const t=step/segments, center=curve.getPointAt(t), tangent=curve.getTangentAt(t);
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
  const initial=new Float32Array(positions);
  const surface=createSurface();
  const material=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.08,side:THREE.DoubleSide,transparent:true});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
  const faceGeometry=new THREE.BufferGeometry();
  faceGeometry.setAttribute('position',geometry.getAttribute('position'));
  faceGeometry.setAttribute('uv',geometry.getAttribute('uv'));faceGeometry.setIndex(frontIndices);
  const face=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({map:surface.texture,transparent:true,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false}));
  face.frustumCulled=false;face.renderOrder=1;
  let route, targetKey = '';
  const center = new THREE.Vector3(), across = new THREE.Vector3(), normal = new THREE.Vector3();
  return {mesh,face,surface,
    setTarget(rect,factor,width,height){
      const nextKey = [rect.left,rect.top,rect.width,rect.height,factor,width,height].join(':');
      if (nextKey === targetKey) return;
      targetKey = nextKey;
      route = createFlightRoute(index, curve, rect, factor, width, height);
    },
    fly(value, brush){
      if (!route) return;
      const state = route.state(value), p = state.p;
      const launch = smooth(0, .04, p);
      const buffer = geometry.getAttribute('position');
      const flightWidth = THREE.MathUtils.lerp(.65, .38, smooth(0, .14, p));
      const width = THREE.MathUtils.lerp(flightWidth, route.halfWidth, state.open);
      const thickness = THREE.MathUtils.lerp(THREE.MathUtils.lerp(.07, .045, smooth(0, .14, p)), .07, state.open);
      for (let step = 0; step <= segments; step++) {
        const t = step / segments, base = step * 12;
        const distance = state.head - (1 - t) * state.length;
        route.sample(distance, center, across, normal);
        const roll = Math.sin(t * Math.PI * 2 + index) * .6 * (1 - smooth(0, .3, p))
          + Math.sin(distance * .4 + index) * .22 * smooth(.05, .3, p) * (1 - state.open);
        const cosine = Math.cos(roll), sine = Math.sin(roll);
        // Flatten the tip before unfolding the width, so the landing is a clean
        // rectangle rather than an enlarged arrowhead.
        const arrow = smooth(.03, .13, p) * (1 - smooth(.75, .84, p));
        const taper = 1 - smooth(.90, 1, t) * arrow;
        const cx = (initial[base] + initial[base + 6]) / 2, cy = (initial[base + 1] + initial[base + 7]) / 2;
        const dx = cx - brush.x, dy = cy - brush.y, radial = Math.hypot(dx, dy);
        const influence = Math.exp(-radial * radial / 3.2) * brush.strength * (1 - smooth(0, .12, p));
        const pushX = dx / Math.max(.4, radial) * influence * .65;
        const pushY = dy / Math.max(.4, radial) * influence * .65;
        for (let c = 0; c < 4; c++) {
          const [side, edge] = corners[c], offset = (step * 4 + c) * 3;
          const ax = across.x*cosine + normal.x*sine, ay = across.y*cosine + normal.y*sine, az = across.z*cosine + normal.z*sine;
          const nx = normal.x*cosine - across.x*sine, ny = normal.y*cosine - across.y*sine, nz = normal.z*cosine - across.z*sine;
          buffer.array[offset] = THREE.MathUtils.lerp(initial[offset], center.x + side*width*taper*ax + edge*thickness*nx, launch) + pushX;
          buffer.array[offset+1] = THREE.MathUtils.lerp(initial[offset+1], center.y + side*width*taper*ay + edge*thickness*ny, launch) + pushY;
          buffer.array[offset+2] = THREE.MathUtils.lerp(initial[offset+2], center.z + side*width*taper*az + edge*thickness*nz, launch) + influence*.07;
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
  const pointer = { x: 0, y: 0, strength: 0 }, eased = { x: 0, y: 0, strength: 0 };
  const brushPoint = new THREE.Vector3();
  let frame = 0, disposed = false, lost = false, width = 1, height = 1, lastTime = 0;
  let layoutDirty = true, surfacesDirty = true, storyTop = 0, enhanced = false, mobile = false, texturePhase = '';
  let animatedScroll = scrollY;
  let quality = readAnimationQuality();
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
    editorNodes = [panels[1].querySelector('.studio-form'), panels[1].querySelector('.studio-live-card .event-card'), panels[1].querySelector(mobile ? '.studio-mobile-controls' : '.studio-orbit')];
    recordNodes = [panels[2].querySelector('.network-source'), ...panels[2].querySelectorAll('.network-event')];
    calendarRects = calendarNodes.map(rect); editorRects = editorNodes.map(rect); recordRects = recordNodes.map(rect);
    layoutDirty = false; surfacesDirty = true;
  }
  function paint(phase) {
    const ratio = texturePixelRatio(devicePixelRatio || 1, quality);
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
      const midHeight = midWidth * THREE.MathUtils.lerp(start.height / start.width, end.height / end.width, smooth(.45, .62, t));
      const mid = { left: width * (.08 + i * .30), top: height * .52 - midHeight / 2, width: midWidth, height: midHeight };
      const box = {};
      if (mobile) {
        const shrink = smooth(0, .23, t), travel = smooth(.23, .76, t), expand = smooth(.76, 1, t);
        const compactWidth = Math.min(start.width, end.width, width * .22);
        const compactHeight = Math.min(start.height, end.height, height * .09);
        const w = THREE.MathUtils.lerp(start.width, compactWidth, shrink);
        const h = THREE.MathUtils.lerp(start.height, compactHeight, shrink);
        box.width = THREE.MathUtils.lerp(w, end.width, expand);
        box.height = THREE.MathUtils.lerp(h, end.height, expand);
        box.left = THREE.MathUtils.lerp(start.left + start.width / 2, end.left + end.width / 2, travel) - box.width / 2;
        box.top = THREE.MathUtils.lerp(start.top + start.height / 2, end.top + end.height / 2, travel) - box.height / 2;
        // Each panel occupies a different horizontal lane during the crossing.
        box.left += Math.sin(travel * Math.PI) * (i - 1) * width * .27;
      } else {
        for (const key of ['left', 'top', 'width', 'height']) box[key] = t < .43 ? THREE.MathUtils.lerp(start[key], mid[key], gather) : THREE.MathUtils.lerp(mid[key], end[key], spread);
      }
      const turn = smooth(.34 + i * .025, .68 + i * .025, t);
      const arc = Math.sin(t * Math.PI);
      panel.group.position.set((box.left + box.width / 2 - width / 2) * f,
        (height / 2 - box.top - box.height / 2) * f + Math.sin(i * 1.9) * arc * (mobile ? .08 : .28),
        -.001 + arc * (i === 1 ? .35 : -.18));
      panel.group.scale.set(box.width * f, box.height * f, 1);
      panel.group.rotation.set(arc * (i - 1) * .1, Math.PI * turn, arc * (i - 1) * -.075);
      panel.front.material.opacity = 1; panel.back.material.opacity = 1;
      panel.group.position.z -= i === 2 ? smooth(.6, 1, t) * .006 : 0;
      panel.group.visible = true;
    });
    camera.position.set(mobile ? 0 : Math.sin(t * Math.PI) * .45, 0, FINAL_DISTANCE - (mobile ? 0 : Math.sin(t * Math.PI) * .35));
    camera.lookAt(0, 0, 0);
  }
  function resize() {
    // Match the CSS small viewport so mobile browser chrome does not stretch the
    // canvas or change the flight's scroll distance when its address bar moves.
    width = innerWidth; height = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(renderPixelRatio(width, height, devicePixelRatio || 1, quality));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    layoutDirty = true; invalidate();
  }
  function draw(time = 0) {
    frame = 0; if (disposed || lost || document.hidden) return;
    const { paused } = getState(), reduced = media.matches || paused;
    root.dataset.motionPaused = String(paused);
    const phone = !reduced && width < 760 && height >= 560;
    const active = !reduced && (phone || width >= 1000 && height >= 690);
    const phoneChanged = phone !== mobile;
    if (phone !== mobile) {
      mobile = phone; root.dataset.mobileStory = String(phone); layoutDirty = true; animatedScroll = scrollY;
    }
    if (active !== enhanced || phoneChanged) {
      story.style.setProperty('--story-height', `${((phone ? MOBILE_STORY : STORY).end + 1) * 100}svh`);
      enhanced = active; root.dataset.storyReady = String(active); layoutDirty = true; animatedScroll = scrollY;
    }
    if (layoutDirty) measure();
    const dt = Math.min(.05, (time - lastTime) / 1000 || .016); lastTime = time;
    animatedScroll += (scrollY - animatedScroll) * (reduced || mobile ? 1 : 1 - Math.exp(-dt * 12));
    if (Math.abs(scrollY - animatedScroll) < .08) animatedScroll = scrollY;
    const s = (animatedScroll - storyTop) / height;
    const entry = mobile ? MOBILE_STORY : STORY;
    let mode = 'none';
    if ((enhanced || mobile) && s >= entry.entryStart && s < entry.calendarIn) mode = 'entry';
    else if (s < 0) mode = 'hero';
    else if (enhanced && s > entry.calendarOut && s < entry.editorIn) mode = 'calendar-editor';
    else if (enhanced && s > entry.editorOut && s < entry.recordsIn) mode = 'editor-records';
    const calendarLive = !enhanced || s >= entry.calendarLand && s <= entry.calendarOut;
    const editorLive = !enhanced || s >= entry.editorIn && s <= entry.editorOut;
    const recordsLive = !enhanced || s >= entry.recordsIn;
    root.dataset.calendarLanded = String(s >= entry.calendarLand); root.dataset.calendarLive = String(calendarLive); root.dataset.editorLive = String(editorLive); root.dataset.recordsLive = String(recordsLive);
    root.dataset.calendarMotion = mode === 'entry' || mode === 'hero' ? 'entry' : mode === 'calendar-editor' ? 'exit' : 'idle';
    const live = [calendarLive, editorLive, recordsLive];
    const show = [!enhanced || s < entry.editorIn, !enhanced || s >= entry.calendarOut && s < entry.recordsIn, !enhanced || s >= entry.editorOut];
    flights.forEach((node, i) => { node.style.visibility = show[i] ? 'visible' : 'hidden'; panels[i].inert = !live[i]; });
    const p = progress(entry.entryStart, entry.calendarLand, s);
    // The surfaces finish moving before their contents are revealed and handed to the DOM.
    const reveal = progress(entry.calendarLand, entry.calendarIn, s);
    const ce = progress(entry.calendarOut, entry.editorIn, s);
    const er = progress(entry.editorOut, entry.recordsIn, s);
    story.style.setProperty('--calendar-copy', String((mobile ? smooth(.55, .95, p) : smooth(.18, .85, reveal)) * (1 - smooth(0, .2, ce))));
    if (mobile) dayNodes.forEach((node, index) => {
      const arrival = smooth(.10 + index * .10, .65 + index * .10, p);
      node.style.setProperty('--mobile-entry-x', `${(index % 2 ? 1 : -1) * (1 - arrival) * (width + 32)}px`);
      node.style.setProperty('--mobile-entry-opacity', String(smooth(0, .18, arrival)));
    });
    story.style.setProperty('--calendar-shell', String(1 - smooth(0, .28, ce)));
    story.style.setProperty('--editor-copy', String(smooth(.83, .99, ce) * (1 - smooth(0, .2, er))));
    story.style.setProperty('--records-copy', String(smooth(.83, .99, er)));
    root.style.setProperty('--hero-copy', String(enhanced || mobile ? 1 - smooth(entry.entryStart, .04, s) : 1));
    const wipe = (from, to, value) => {
      if (value <= 0) return from;
      if (value >= 1) return to;
      const edge = value * 140 - 20;
      return 'linear-gradient(115deg,' + to + ' ' + edge + '%,' + from + ' ' + (edge + .1) + '%)'; // taste-skill-ignore: a moving hard edge between two flat fields, without a colour blend.
    };
    story.style.setProperty('--story-paper', er > 0 ? wipe('#1c211b', '#f4f4ef', smooth(.12, .8, er)) : wipe('#f4f4ef', '#1c211b', smooth(.12, .8, ce)));

    const damping = 1 - Math.exp(-dt * 12);
    eased.x += ((reduced ? 0 : pointer.x) - eased.x) * damping;
    eased.y += ((reduced ? 0 : pointer.y) - eased.y) * damping;
    eased.strength += ((reduced ? 0 : pointer.strength) - eased.strength) * damping;
    ribbons.visible = mode === 'hero' || mode === 'entry' && !mobile;
    panels3d.forEach(panel => { panel.group.visible = false; });
    if (mode !== 'none' && !(mobile && mode === 'entry') && (surfacesDirty || texturePhase !== mode)) paint(mode);
    if (ribbons.visible) {
      ribbons.position.set(0, 0, 0);
      ribbons.rotation.set(0, 0, 0);
      ribbons.scale.setScalar(mobile && mode === 'entry' ? THREE.MathUtils.lerp(.63, 1, smooth(0, .25, p)) : width < 760 ? .63 : 1);
      ribbons.updateMatrixWorld(true);
      brushPoint.set(eased.x * width / 2 * factor(), eased.y * height / 2 * factor(), 0);
      ribbons.worldToLocal(brushPoint);
      const brush = { x: brushPoint.x, y: brushPoint.y, strength: eased.strength };
      days.forEach(day => {
        day.fly(mode === 'entry' ? p : 0, brush);
        const landing = mode === 'entry' ? smooth(0, .8, reveal) : 0;
        day.face.material.opacity = 0; day.mesh.material.opacity = 1 - landing;
      });
      camera.position.set(0, 0, mobile && mode === 'entry' ? THREE.MathUtils.lerp(13, FINAL_DISTANCE, smooth(0, .25, p)) : width < 760 ? 13 : FINAL_DISTANCE);
      camera.lookAt(0, 0, 0);
    }
    if (mode === 'calendar-editor') bridge(ce, calendarRects, editorRects, mode);
    if (mode === 'editor-records') bridge(er, editorRects, recordRects, mode);
    canvas.style.opacity = mode === 'none' || mobile && mode === 'entry' ? '0' : mobile && mode === 'hero' ? String(1 - smooth(entry.entryStart - .22, entry.entryStart, s)) : '1'; root.dataset.camera = mode;
    canvas.style.clipPath = 'none';
    if (mode !== 'none' && !(mobile && mode === 'entry')) renderer.render(scene, camera);
    const settling = Math.abs(eased.x - (reduced ? 0 : pointer.x)) + Math.abs(eased.y - (reduced ? 0 : pointer.y)) + Math.abs(eased.strength - (reduced ? 0 : pointer.strength)) > .002;
    if (!reduced && (Math.abs(scrollY - animatedScroll) > .08 || (mode === 'hero' || mode === 'entry') && settling)) frame = requestAnimationFrame(draw);
  }
  function invalidate() { if (!disposed && !lost && !frame && !document.hidden) frame = requestAnimationFrame(draw); }
  function onQuality(event) {
    if (event.type === 'storage' && event.key && event.key !== ANIMATION_QUALITY_KEY) return;
    quality = event.type === APPEARANCE_CHANGE ? event.detail : readAnimationQuality();
    surfacesDirty = true; resize();
  }
  function refresh() { layoutDirty = true; surfacesDirty = true; invalidate(); }
  function onPointer(event) {
    const overRibbon = event.pointerType !== 'touch' && hero.contains(event.target) && !event.target.closest('a,button,input');
    if (!overRibbon && !pointer.strength) return;
    pointer.x = (event.clientX / width - .5) * 2;
    pointer.y = (.5 - event.clientY / height) * 2;
    pointer.strength = overRibbon ? 1 : 0;
    invalidate();
  }
  function onPointerLeave() { pointer.strength = 0; invalidate(); }
  function onVisibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else invalidate(); }
  function restorePanels() {
    root.dataset.storyReady = 'false';
    root.dataset.mobileStory = 'false';
    flights.forEach(node => { node.style.visibility = ''; });
    panels.forEach(panel => { panel.inert = false; });
  }
  function onLost(event) { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; root.dataset.world = 'fallback'; restorePanels(); }
  window.addEventListener(APPEARANCE_CHANGE, onQuality); window.addEventListener('storage', onQuality);
  window.addEventListener('scroll', invalidate, { passive: true }); window.addEventListener('resize', resize); window.addEventListener('pointermove', onPointer, { passive: true });
  root.addEventListener('input', refresh); root.addEventListener('click', refresh);
  hero.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibility); media.addEventListener('change', refresh); canvas.addEventListener('webglcontextlost', onLost);
  root.dataset.world = 'ready'; resize();
  const observer = new ResizeObserver(refresh); observer.observe(root); panels.forEach(panel => observer.observe(panel));
  document.fonts?.ready.then(() => { if (!disposed) refresh(); });
  return { invalidate: refresh, dispose() {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    window.removeEventListener(APPEARANCE_CHANGE, onQuality); window.removeEventListener('storage', onQuality);
    window.removeEventListener('scroll', invalidate); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onPointer);
    root.removeEventListener('input', refresh); root.removeEventListener('click', refresh);
    hero.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener('change', refresh); canvas.removeEventListener('webglcontextlost', onLost);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? [object.material].flat() : []) { materials.add(material); if (material.map) textures.add(material.map); }
    });
    geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); renderer.dispose(); restorePanels();
  } };
}
