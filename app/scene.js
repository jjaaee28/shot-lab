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
  { id:'fixed',       name:'고정 촬영',     english:'STATIC',      glyph:'⊡', description:'선택한 위치에서 카메라가 멈춰 장면을 바라봅니다. 인물의 표정이나 공간 분위기를 차분하게 전달할 때 씁니다.', duration:0 },
  { id:'in',          name:'달리 인',       english:'DOLLY IN',    glyph:'↗', description:'카메라가 앞으로 이동해 인물에 가까워집니다. 집중감·긴장감을 높이거나 감정을 강조할 때 씁니다.', duration:5 },
  { id:'out',         name:'달리 아웃',     english:'DOLLY OUT',   glyph:'↙', description:'카메라가 뒤로 물러나며 인물과 주변 공간이 함께 드러납니다. 고립감·여운을 표현할 때 씁니다.', duration:5 },
  { id:'orbit_right', name:'아크 샷 · 시계 방향', english:'ARC SHOT · CW',   glyph:'⟳', description:'카메라가 인물을 중심으로 시계 방향의 원형 경로를 이동하며 360° 촬영합니다. 인물과 공간을 입체적으로 보여줄 때 씁니다.', duration:10 },
  { id:'orbit_left',  name:'아크 샷 · 반시계 방향', english:'ARC SHOT · CCW',  glyph:'⟲', description:'카메라가 인물을 중심으로 반시계 방향의 원형 경로를 이동하며 360° 촬영합니다.', duration:10 },
  { id:'tilt_up',     name:'틸트 업',       english:'TILT UP',     glyph:'↑', description:'카메라 위치는 고정한 채 렌즈 각도를 아래에서 위로 올립니다. 웅장함·상승감을 표현할 때 씁니다.', duration:5 },
  { id:'tilt_down',   name:'틸트 다운',     english:'TILT DOWN',   glyph:'↓', description:'카메라 위치는 고정한 채 렌즈 각도를 위에서 아래로 내립니다. 압박감·내려보는 시선을 표현합니다.', duration:5 },
  { id:'crane_up',    name:'크레인 업',     english:'CRANE UP',    glyph:'⤴', description:'카메라가 공중으로 높이 올라가며 장면 전체를 내려다봅니다. 장대한 스케일·신의 시점을 보여줄 때 씁니다.', duration:7 },
  { id:'boom_down',   name:'붐 다운',       english:'BOOM DOWN',   glyph:'⤵', description:'카메라가 높은 곳에서 아래로 내려오며 인물에게 다가갑니다. 장면에 집중을 유도할 때 씁니다.', duration:7 },
];
export function cameraPose(method, progress, angle, elevation) {
  const t=Math.max(0,Math.min(1,progress));
  // Dolly: radius changes, elevation fixed
  const isOrbit=method==='orbit_right'||method==='orbit_left'||method==='orbit';
  const orbitDir=method==='orbit_left'?-1:1;
  const azimuth=angle+(isOrbit?orbitDir*t*Math.PI*2:0);
  // Tilt: camera position fixed, elevation angle changes over time
  let elev=elevation;
  if(method==='tilt_up')   elev=elevation+t*0.62;   // tilt up ~35deg
  if(method==='tilt_down') elev=elevation-t*0.45;   // tilt down ~25deg, clamped
  elev=Math.max(-0.18,Math.min(1.05,elev));
  // Crane/Boom: camera height changes (elevation shifts substantially)
  let radius=method==='in'?6.2-2.9*t:method==='out'?3.3+2.9*t:5.0;
  let craneElev=elev;
  if(method==='crane_up')  craneElev=elevation+t*0.85;  // rise from start elev up high
  if(method==='boom_down') craneElev=(elevation+0.80)-t*0.80; // descend from high to start
  craneElev=Math.max(-0.18,Math.min(1.05,craneElev));
  const finalElev=(method==='crane_up'||method==='boom_down')?craneElev:elev;
  return {
    angle: azimuth,
    radius,
    elevation: finalElev,
    position: [
      Math.sin(azimuth)*radius*Math.cos(finalElev),
      1.12+Math.sin(finalElev)*radius,
      Math.cos(azimuth)*radius*Math.cos(finalElev)
    ]
  };
}
