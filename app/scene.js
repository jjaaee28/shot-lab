import * as THREE from 'three';

const PAPER = 0xf2e9da;
const INK = 0x161616;
export function buildScene(scene) {
  const fill = new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const ink = new THREE.LineBasicMaterial({ color: INK });
  const outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const root = new THREE.Group(); scene.add(root);
  function solid(geometry, position, parent = root, rounded = false) {
    const mesh = new THREE.Mesh(geometry, fill); mesh.position.set(...position); parent.add(mesh);
    if (rounded) {
      const hull = new THREE.Mesh(geometry, outline); hull.scale.setScalar(1.025); mesh.add(hull);
    } else mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), ink));
    return mesh;
  }
  function box(w,h,d,p,parent=root) { return solid(new THREE.BoxGeometry(w,h,d),p,parent); }
  function ellipsoid(x,y,z,p,parent=root) { const m=solid(new THREE.SphereGeometry(1,24,16),p,parent,true); m.scale.set(x,y,z); return m; }
  function limb(a,b,r) {
    const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b);
    const m=solid(new THREE.CylinderGeometry(r,r*.92,start.distanceTo(end),16),start.clone().add(end).multiplyScalar(.5).toArray(),root,true);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize()); return m;
  }
  function line(points,parent=root) { const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))); const l=new THREE.Line(g,ink); parent.add(l); return l; }
  // Open set: no walls to obstruct a complete orbit.
  box(5.4,.035,4.8,[0,-.05,0]);
  // Chair, backrest and four legs.
  box(.85,.10,.82,[0,.76,-.13]);
  for (const x of [-.34,.34]) for (const z of [-.44,.18]) box(.065,.72,.065,[x,.36,z]);
  for(const x of [-.35,.35]) box(.07,.85,.07,[x,1.14,-.47]);
  box(.75,.38,.065,[0,1.36,-.47]);
  // A seated reader, made entirely from basic geometry.
  ellipsoid(.33,.42,.23,[0,1.22,-.04]);
  ellipsoid(.30,.15,.24,[0,.86,.0]);
  limb([0,1.50,-.02],[0,1.65,.035],.085);
  const head=ellipsoid(.225,.28,.22,[0,1.85,.045]); head.rotation.x=.23;
  ellipsoid(.065,.065,.07,[0,1.83,.257]);
  for(const x of [-.09,.09]) line([[x-.025,1.90,.251],[x+.025,1.89,.258]]);
  for (const side of [-1,1]) {
    limb([side*.15,.82,.04],[side*.21,.69,.49],.115);
    limb([side*.21,.69,.49],[side*.22,.17,.56],.08);
    ellipsoid(.11,.075,.20,[side*.22,.085,.64]);
    limb([side*.29,1.47,.01],[side*.39,1.13,.22],.075);
    limb([side*.39,1.13,.22],[side*.29,1.21,.58],.06);
    ellipsoid(.075,.052,.095,[side*.28,1.21,.60]);
  }
  // Two page blocks form an open book. Visible page lines aid recognition.
  const book=new THREE.Group(); book.position.set(0,1.17,.59); book.rotation.x=.35; root.add(book);
  for(const side of [-1,1]) {
    const page=new THREE.Group(); page.rotation.z=side*.16; book.add(page);
    box(.34,.045,.40,[side*.17,0,0],page);
    box(.36,.018,.43,[side*.18,-.032,0],page);
    for(let i=0;i<5;i++) line([[side*.045,.025,-.13+i*.056],[side*.29,.025,-.13+i*.056]],page);
  }
  // Small side table and closed book.
  box(.90,.08,.67,[1.5,.90,-.35]);
  for(const x of [1.15,1.85]) for(const z of [-.58,-.12]) box(.05,.88,.05,[x,.44,z]);
  box(.38,.07,.26,[1.5,.98,-.35]);
  line([[1.31,.98,-.216],[1.68,.98,-.216]]);
  // Freestanding window frame gives depth cues without an opaque wall.
  for(const x of [-1.8,-.55]) box(.045,1.35,.05,[x,1.60,-1.55]);
  for(const y of [.925,2.275]) box(1.295,.045,.05,[-1.175,y,-1.55]);
  box(.03,1.35,.04,[-1.175,1.60,-1.55]);
  box(1.25,.03,.04,[-1.175,1.60,-1.55]);
  return () => {
    const geometries=new Set(), materials=new Set();
    root.traverse(o=> {if(o.geometry) geometries.add(o.geometry); if(o.material) materials.add(o.material);});
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); scene.remove(root);
  };
}
export const PRESETS = [
  { id:'front', name:'눈높이 정면', angle:0, elevation:0 },
  { id:'side', name:'눈높이 측면', angle:Math.PI/2, elevation:0 },
  { id:'high', name:'높은 위치', angle:0, elevation:.48 },
  { id:'low', name:'낮은 위치', angle:0, elevation:-.12 },
];
export const METHODS = [
  { id:'fixed', name:'고정 촬영', english:'STATIC', glyph:'⊡', description:'선택한 위치에서 가만히 바라봅니다.', duration:0 },
  { id:'in', name:'달리 인', english:'DOLLY IN', glyph:'↗', description:'카메라가 다가가며 인물이 크게 보입니다.', duration:5 },
  { id:'out', name:'달리 아웃', english:'DOLLY OUT', glyph:'↙', description:'카메라가 멀어지며 주변 공간이 드러납니다.', duration:5 },
  { id:'orbit_right', name:'주변 돌기 (우)', english:'ORBIT RIGHT', glyph:'⟳', description:'인물을 바라보며 오른쪽으로 360° 한 바퀴 돕니다.', duration:10 },
  { id:'orbit_left', name:'주변 돌기 (좌)', english:'ORBIT LEFT', glyph:'⟲', description:'인물을 바라보며 왼쪽으로 360° 한 바퀴 돕니다.', duration:10 },
];
export function cameraPose(method, progress, angle, elevation) {
  const t=Math.max(0,Math.min(1,progress));
  const radius=method==='in'?6.2-2.9*t:method==='out'?3.3+2.9*t:5.0;
  const isOrbit=method==='orbit_right'||method==='orbit_left'||method==='orbit';
  const orbitDir=method==='orbit_left'?-1:1;
  const azimuth=angle+(isOrbit?orbitDir*t*Math.PI*2:0);
  return { angle:azimuth, radius, position:[Math.sin(azimuth)*radius*Math.cos(elevation),1.12+Math.sin(elevation)*radius,Math.cos(azimuth)*radius*Math.cos(elevation)] };
}
