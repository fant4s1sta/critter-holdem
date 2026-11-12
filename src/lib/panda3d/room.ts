import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const cream = '#ffe5b5';
export const TABLE_Y = 1.43;
const TABLE_WIDTH_SCALE = 1.15;
const TABLE_NEAR_EXTENSION = 2.5;
export const SEAT_SCALE = 1.12;
const SEATS = [
  { x: -2.68, z: 1.35, angle: Math.PI / 2 },
  { x: -2.68, z: -1.8, angle: Math.PI / 2.6 },
  { x: 0, z: -3.8, angle: 0 },
  { x: 2.68, z: -1.8, angle: -Math.PI / 2.6 },
  { x: 2.68, z: 1.35, angle: -Math.PI / 2 },
];
export const EIGHT_SEATS = [
  ...SEATS.map((seat,i)=>i===2?seat:{...seat,z:seat.z-1,angle:i===1?Math.PI/4:i===3?-Math.PI/4:seat.angle}),
  { x: -2.68, z: 2.35, angle: Math.PI / 2 },
  { x: 2.68, z: 2.35, angle: -Math.PI / 2 },
];
export function seatsForPlayers(players: 6 | 8) { return players === 8 ? EIGHT_SEATS : SEATS; }


export function material(color: THREE.ColorRepresentation, roughness = .65) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}
export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, p: number[] = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(p[0], p[1], p[2]); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function rounded(parent: THREE.Object3D, size: number[], p: number[], mat: THREE.Material, radius = .06) {
  return mesh(parent, new RoundedBoxGeometry(size[0], size[1], size[2], 4, radius), mat, p);
}
function sphere(parent: THREE.Object3D, size: number[], p: number[], mat: THREE.Material) {
  const m = mesh(parent, new THREE.SphereGeometry(1, 40, 28), mat, p); m.scale.set(size[0], size[1], size[2]); return m;
}
export function lineTube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, mat: THREE.Material, closed = false) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(48, points.length * 4), radius, 8, closed), mat);
}
function stadium(radius: number, halfStraight: number) {
  const s = new THREE.Shape();
  const near=-halfStraight-TABLE_NEAR_EXTENSION;
  s.moveTo(radius, near); s.lineTo(radius, halfStraight);
  s.absarc(0, halfStraight, radius, 0, Math.PI, false);
  s.lineTo(-radius, near); s.absarc(0, near, radius, Math.PI, Math.PI * 2, false);
  return s;
}
export function addTable(parent: THREE.Object3D) {
  const g = new THREE.Group(); parent.add(g);g.position.z = .35;g.scale.x = TABLE_WIDTH_SCALE;
  const wood = material('#a95425', .43), rail = material('#c47c39', .46);
  const shape = stadium(1.48, 1.71);
  const slab = mesh(g, new THREE.ExtrudeGeometry(shape, { depth: .19, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: .09, bevelThickness: .075, curveSegments: 60 }), wood);
  slab.rotation.x = -Math.PI / 2; slab.position.y = TABLE_Y - .28;
  const felt = material('#325b32', .99);
  // Fine procedural felt is restrained: no photographic fur/noise on characters.
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d')!; ctx.fillStyle = '#7f7f7f'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {ctx.strokeStyle = i % 4 ? '#808080' : '#7c7c7c';ctx.beginPath();ctx.moveTo(i, 0);ctx.lineTo(i, 256);ctx.stroke();}
  const feltMap = new THREE.CanvasTexture(c); feltMap.wrapS = feltMap.wrapT = THREE.RepeatWrapping; feltMap.repeat.set(9, 18);
  felt.bumpMap = feltMap; felt.bumpScale = .012;
  const top = mesh(g, new THREE.ShapeGeometry(stadium(1.34, 1.71), 80), felt, [0, TABLE_Y, 0]); top.rotation.x = -Math.PI / 2;
  const points = stadium(1.44, 1.71).getSpacedPoints(150).map(p => new THREE.Vector3(p.x, TABLE_Y + .015, -p.y));
  lineTube(g, points, .13, rail, true);
  const seam = stadium(1.305, 1.71).getSpacedPoints(150).map(p => new THREE.Vector3(p.x, TABLE_Y + .006, -p.y));
  lineTube(g, seam, .007, material('#b8a16c'), true);
  for (const z of [-1.6, 1.6]) {
    mesh(g, new THREE.CylinderGeometry(.21, .3, 1.25, 24), wood, [0, .62, z]);
    rounded(g, [1.7, .15, .55], [0, .13, z], wood);
  }
}
export function addChair(parent: THREE.Object3D) {
  const chair = new THREE.Group(); parent.add(chair);
  const wood = material('#8c4827', .49), leather = material('#a86b3d', .78), piping = material('#cf9961', .64);
  rounded(chair, [1.06, .18, .92], [0, .73, -.06], wood, .09);
  rounded(chair, [.96, .18, .84], [0, .85, -.035], leather, .08);
  const back = rounded(chair, [1.1, 1.17, .2], [0, 1.34, -.49], wood, .15); back.rotation.x = -.09;
  const cushion = rounded(chair, [.91, .93, .13], [0, 1.37, -.355], leather, .13); cushion.rotation.x = -.09;
  lineTube(chair, [new THREE.Vector3(-.4, 1.03, -.26), new THREE.Vector3(-.4, 1.72, -.32), new THREE.Vector3(0, 1.8, -.32), new THREE.Vector3(.4, 1.72, -.32), new THREE.Vector3(.4, 1.03, -.26)], .009, piping);
  for (const x of [-.4, .4]) for (const z of [-.37, .3]) {
    const leg = mesh(chair, new THREE.CylinderGeometry(.048, .065, .75, 16), wood, [x, .375, z]); leg.rotation.z = -x * .13;
  }
}
function cardTexture(rank?: string, suit?: string) {
  const c = document.createElement('canvas');c.width = 256;c.height = 360;const ctx = c.getContext('2d')!;
  ctx.fillStyle = rank ? '#fff1ce' : '#34503a';ctx.fillRect(0, 0, 256, 360);
  ctx.strokeStyle = '#d8b978'; ctx.lineWidth = 4;ctx.beginPath();ctx.roundRect(11, 11, 234, 338, 16);ctx.stroke();
  if (rank) {
    ctx.fillStyle = suit === '♥' || suit === '♦' ? '#b62d19' : '#25231e';
    ctx.textAlign = 'left';ctx.font = 'bold 73px Georgia';ctx.fillText(rank, 25, 85);
    ctx.font = '65px Georgia';ctx.fillText(suit!, 28, 147);
    ctx.textAlign = 'center';ctx.font = '140px Georgia';ctx.fillText(suit!, 135, 278);
    ctx.save();ctx.translate(256, 360);ctx.rotate(Math.PI);ctx.textAlign = 'left';ctx.font = 'bold 34px Georgia';ctx.fillText(rank, 24, 48);ctx.restore();
  } else {
    ctx.fillStyle = '#c7a04e';ctx.beginPath();ctx.ellipse(128, 205, 43, 33, 0, 0, Math.PI * 2);ctx.fill();
    for (const [x,y] of [[75,161],[110,140],[148,140],[182,161]]) {ctx.beginPath();ctx.ellipse(x,y,13,19,(x-128)*.009,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle = '#a88f4855';ctx.lineWidth = 1;for(let i=30;i<330;i+=18){ctx.beginPath();ctx.moveTo(20,i);ctx.lineTo(236,i+80);ctx.stroke();}
  }
  const tex = new THREE.CanvasTexture(c);tex.colorSpace = THREE.SRGBColorSpace;tex.anisotropy = 8;return tex;
}
function cardOutline(width: number, height: number, radius: number) {
  const shape=new THREE.Shape(),x=-width/2,y=-height/2,r=radius;
  shape.moveTo(x+r,y);shape.lineTo(x+width-r,y);
  shape.quadraticCurveTo(x+width,y,x+width,y+r);
  shape.lineTo(x+width,y+height-r);shape.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  shape.lineTo(x+r,y+height);shape.quadraticCurveTo(x,y+height,x,y+height-r);
  shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);shape.closePath();
  return shape;
}
const cardMaterials = new Map<string, THREE.MeshStandardMaterial>();
export function addCard(parent: THREE.Object3D, rank: string | undefined, suit: string | undefined, width: number) {
  const key = `${rank || 'back'}${suit || ''}`;
  let face = cardMaterials.get(key);
  if (!face) {face = new THREE.MeshStandardMaterial({map:cardTexture(rank,suit),roughness:.78});cardMaterials.set(key,face);}
  const g = new THREE.Group();parent.add(g);
  // Round the silhouette in the card plane: a thin rounded box limits its
  // corner radius to half the paper thickness and still looks square head-on.
  const height=width*1.406,radius=width*.085;
  const body=new THREE.ExtrudeGeometry(cardOutline(width,height,radius),{
    depth:.012,bevelEnabled:true,bevelSegments:2,steps:1,
    bevelSize:.001,bevelThickness:.001,curveSegments:10,
  });
  mesh(g,body,material(cream),[0,0,-.006]);
  const faceWidth=width*.984,faceHeight=height-width*.016;
  const surface=new THREE.ShapeGeometry(cardOutline(faceWidth,faceHeight,radius-width*.008),10);
  const positions=surface.getAttribute('position'),uv=surface.getAttribute('uv');
  for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)/faceWidth+.5,positions.getY(i)/faceHeight+.5);
  const m=mesh(g,surface,face,[0,0,.008]);m.castShadow=false;
  return g;
}
export function addChips(parent: THREE.Object3D, x: number, z: number, count: number, color: string, value: number) {
  const g = new THREE.Group();parent.add(g);g.position.set(x,0,z);
  const mat = material(color,.42), ivory = material('#ffe6b4',.53);
  for(let i=0;i<count;i++) {
    const cy = .027 + i*.051; mesh(g,new THREE.CylinderGeometry(.105,.105,.045,40),mat,[0,cy,0]);
    const ring = mesh(g,new THREE.TorusGeometry(.077,.008,5,40),ivory,[0,cy+.024,0]);ring.rotation.x=-Math.PI/2;
    for(let j=0;j<6;j++) {const a=j*Math.PI/3;const stripe=rounded(g,[.028,.047,.018],[Math.cos(a)*.099,cy,Math.sin(a)*.099],ivory,.002);stripe.rotation.y=-a+Math.PI/2;}
  }
  // Static chip stacks share two draw calls instead of one for every tiny stripe.
  g.updateMatrixWorld(true);
  for(const material of [mat,ivory]) {
    const parts=(g.children as THREE.Mesh[]).filter(m=>m.material===material);
    const geometries=parts.map(m=>(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix));
    const combined=mergeGeometries(geometries,false);
    for(const part of parts){g.remove(part);part.geometry.dispose();}
    geometries.forEach(geometry=>geometry.dispose());
    if(combined)mesh(g,combined,material);
  }
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,128,128);
  ctx.fillStyle='#fff4d9';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(value),64,66,118);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  const label=mesh(g,new THREE.CircleGeometry(.069,32),new THREE.MeshStandardMaterial({map,roughness:.7}),[0,.052+(count-1)*.051,0]);
  label.rotation.x=-Math.PI/2;label.castShadow=false;
  return g;
}
function nightTexture() {
  const c=document.createElement('canvas');c.width=1024;c.height=768;const ctx=c.getContext('2d')!;
  const sky=ctx.createLinearGradient(0,0,0,768);sky.addColorStop(0,'#12263d');sky.addColorStop(1,'#3f6a77');ctx.fillStyle=sky;ctx.fillRect(0,0,1024,768);
  const glow=ctx.createRadialGradient(780,170,20,780,170,140);glow.addColorStop(0,'#fff0be');glow.addColorStop(.3,'#f8e1a3');glow.addColorStop(.4,'#aab4a166');glow.addColorStop(1,'#9dad9400');ctx.fillStyle=glow;ctx.fillRect(620,10,320,320);
  ctx.fillStyle='#fff1cd';ctx.beginPath();ctx.arc(780,170,42,0,Math.PI*2);ctx.fill();
  for(let layer=0;layer<3;layer++) for(let i=0;i<11;i++) {const x=i*113+Math.sin(i*3.2+layer)*50;const h=220+Math.sin(i*1.3+layer)*100+layer*50;ctx.fillStyle=['#25485a','#183b48','#142e34'][layer];for(let k=0;k<5;k++){const y=768-layer*40-h+k*h*.16;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-40-k*10,y+h*.36);ctx.lineTo(x+40+k*10,y+h*.36);ctx.fill();}}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function addRoom(scene: THREE.Scene) {
  const wood=material('#713e24',.79), trim=material('#9d6338',.56), floor=material('#603e2a',.8);
  for(let i=-6;i<7;i++) rounded(scene,[.95,.12,19],[i*.98,-.08,0],floor,.025);
  rounded(scene,[13,8,.3],[0,3.7,-5.3],wood,.03);
  for(let y=.2;y<8;y+=.62) rounded(scene,[13,.025,.04],[0,y,-5.13],material('#4c2c1b'),.005);
  for(const x of [-5.1,5.1]) rounded(scene,[.4,8,18],[x,3.7,1],wood);
  // One large window, deep frame and cool forest light counter the warm key.
  const window = mesh(scene,new THREE.PlaneGeometry(4.9,3.6),new THREE.MeshBasicMaterial({map:nightTexture()}),[.65,3.05,-5.08]);window.castShadow=false;
  for(const x of [-1.9,.65,3.2]) rounded(scene,[.14,3.87,.24],[x,3.05,-4.95],trim);
  for(const y of [1.15,3.05,4.95]) rounded(scene,[5.24,.14,.3],[.65,y,-4.92],trim);
  rounded(scene,[5.65,.2,.57],[.65,1.07,-4.85],trim);
  for(const y of [1.8,3.6]) {rounded(scene,[1.5,.16,.7],[-3.85,y,-4.76],trim);for(let j=0;j<6;j++) {const m=rounded(scene,[.14,.35+j%3*.13,.3],[-4.4+j*.19,y+.26,-4.8],material(['#a4773a','#57715d','#bf7249'][j%3]),.015);m.rotation.z=Math.sin(j*4)*.12;}}
  // Pendant shade is a continuous curved surface.
  const shadePoints=[new THREE.Vector2(0,0),new THREE.Vector2(.17,0),new THREE.Vector2(.2,-.12),new THREE.Vector2(.38,-.2),new THREE.Vector2(.67,-.48),new THREE.Vector2(.75,-.78)];
  const shade=mesh(scene,new THREE.LatheGeometry(shadePoints,64),new THREE.MeshStandardMaterial({color:'#344d38',roughness:.4,side:THREE.DoubleSide}),[0,5.6,-1.1]);
  sphere(scene,[.18,.2,.18],[0,4.95,-1.1],new THREE.MeshStandardMaterial({color:'#fff1b9',emissive:'#ffd48b',emissiveIntensity:2}));
  mesh(scene,new THREE.CylinderGeometry(.025,.025,3,12),material('#25281e'),[0,7.1,-1.1]);
  const rim=mesh(scene,new THREE.TorusGeometry(.75,.025,12,64),material('#d1b06a'),[0,4.82,-1.1]);rim.rotation.x=Math.PI/2;
  shade.receiveShadow=false;
  // Broad leafy silhouette, without visually noisy surface detail.
  mesh(scene,new THREE.CylinderGeometry(.28,.2,.5,32),material('#9c6136'),[-3.3,.3,-3.6]);
  for(let i=0;i<9;i++){const a=i*2.4;const leaf=sphere(scene,[.19,.48,.07],[-3.3+Math.sin(a)*.33,.75+i*.13,-3.6+Math.cos(a)*.2],material(i%2?'#526d31':'#718844'));leaf.rotation.set(.1, a, Math.sin(a)*.8);}
}

export function disposeRoomCaches() { for(const mat of cardMaterials.values()){mat.map?.dispose();mat.dispose();}cardMaterials.clear(); }
