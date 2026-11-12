import * as THREE from 'three';
import { lineTube, material, mesh } from './room';

const surfaceCache = new WeakMap<THREE.BufferGeometry, Float32Array>();
export function faceSurface(source:THREE.BufferGeometry) {
  const xMin=-.075,xMax=.075,yMin=.595,yMax=.681,nx=57,ny=49;
  let depth=surfaceCache.get(source);
  if(!depth){
    const positions=source.attributes.position.clone();positions.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI/2));
    const indices:number[]=[];
    for(let i=0;i<source.index!.count;i+=3){const ids=[0,1,2].map(k=>source.index!.getX(i+k));if(ids.some(v=>positions.getZ(v)>.17&&positions.getY(v)>.58&&positions.getY(v)<.70&&Math.abs(positions.getX(v))<.09))indices.push(...ids);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',positions);geo.setIndex(indices);geo.computeBoundingSphere();
    const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),patch=new THREE.Mesh(geo,mat),ray=new THREE.Raycaster();
    depth=new Float32Array(nx*ny);
    for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){const x=xMin+(xMax-xMin)*ix/(nx-1),y=yMin+(yMax-yMin)*iy/(ny-1);ray.set(new THREE.Vector3(x,y,.5),new THREE.Vector3(0,0,-1));depth[iy*nx+ix]=ray.intersectObject(patch,false)[0]?.point.z??.235;}
    geo.dispose();mat.dispose();surfaceCache.set(source,depth);
  }
  const samples = depth;
  // A fixed small grid avoids unbounded per-frame raycast/memoization work as a
  // mouth opens. Every intermediate mouth shape stays on the same curved face.
  return (x:number,y:number)=>{const u=THREE.MathUtils.clamp((x-xMin)/(xMax-xMin)*(nx-1),0,nx-1.001),v=THREE.MathUtils.clamp((y-yMin)/(yMax-yMin)*(ny-1),0,ny-1.001),ix=Math.floor(u),iy=Math.floor(v),a=u-ix,b=v-iy;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(samples[iy*nx+ix],samples[iy*nx+ix+1],a),THREE.MathUtils.lerp(samples[(iy+1)*nx+ix],samples[(iy+1)*nx+ix+1],a),b);};
}

/** Separate facial controls on the authored head, rather than squashing its eye patches. */
export class PandaFace {
  readonly group=new THREE.Group();
  private readonly eyes:{pupil:THREE.Group;lid:THREE.Mesh;side:number}[]=[];
  private readonly smile:THREE.Mesh;
  private readonly happy=new THREE.Group();
  private readonly patches:{mesh:THREE.Mesh;xy:Float32Array;offset:number;pivot:number;last:number}[]=[];
  private readonly surface:(x:number,y:number)=>number;
  constructor(surface:(x:number,y:number)=>number) {
    this.surface=surface;
    const black=new THREE.MeshPhysicalMaterial({color:'#15191e',roughness:.3,clearcoat:.3});
    const lidMaterial=material('#24282e',.85);
    for(const side of [-1,1]) {
      const root=new THREE.Group();root.position.set(side*.088,.716,.201);root.rotation.y=side*.32;this.group.add(root);
      const pupil=new THREE.Group();root.add(pupil);
      const eye=mesh(pupil,new THREE.SphereGeometry(1,24,20),black);eye.scale.set(.0155,.022,.012);
      const glint=mesh(pupil,new THREE.SphereGeometry(1,12,10),new THREE.MeshBasicMaterial({color:'#fffae8'}),[-.004,.007,.0105]);glint.scale.set(.003,.0038,.0012);
      const points=[[-.019,0,.005],[-.01,.006,.010],[0,.008,.012],[.01,.006,.010],[.019,0,.005]].map(p=>new THREE.Vector3(...p as [number,number,number]));
      const lid=lineTube(root,points,.002,lidMaterial);this.eyes.push({pupil,lid,side});
    }
    const smilePoints=Array.from({length:13},(_,i)=>{const x=(i/12-.5)*.078,y=.632+.018*Math.pow(Math.abs(x)/.039,1.7);return new THREE.Vector3(x,y,surface(x,y)+.0024);});
    this.smile=lineTube(this.group,smilePoints,.0024,lidMaterial);
    const curved=(shape:THREE.Shape,mat:THREE.Material,offset=.0025,pivot=.64)=>{
      const outline=new THREE.ShapeGeometry(shape,24),flat=outline.toNonIndexed();outline.dispose();
      let coords=Array.from(flat.attributes.position.array);flat.dispose();
      // Interior vertices are needed too: one flat triangle would sink into a round cheek.
      for(let pass=0;pass<2;pass++){const next:number[]=[];for(let i=0;i<coords.length;i+=9){const a=coords.slice(i,i+3),b=coords.slice(i+3,i+6),c=coords.slice(i+6,i+9);const ab=a.map((v,k)=>(v+b[k])/2),bc=b.map((v,k)=>(v+c[k])/2),ca=c.map((v,k)=>(v+a[k])/2);next.push(...a,...ab,...ca,...ab,...b,...bc,...ca,...bc,...c,...ab,...bc,...ca);}coords=next;}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));const p=geo.attributes.position;
      // The mouth follows the actual authored cheeks, including the 3/4 profile.
      for(let i=0;i<p.count;i++)p.setZ(i,surface(p.getX(i),p.getY(i))+offset);
      geo.computeVertexNormals();const m=mesh(this.group,geo,mat);this.patches.push({mesh:m,xy:new Float32Array(p.array),offset,pivot,last:1});return m;
    };
    const mouthMat=material('#652a20',.95),tongueMat=material('#dd8168',.9);
    const happyShape=new THREE.Shape();happyShape.moveTo(-.037,.652);happyShape.quadraticCurveTo(0,.647,.037,.652);happyShape.bezierCurveTo(.03,.607,-.03,.607,-.037,.652);
    const happyMouth=curved(happyShape,mouthMat);this.group.remove(happyMouth);this.happy.add(happyMouth);this.group.add(this.happy);
    const tongue=new THREE.Shape();tongue.absellipse(0,.622,.018,.0065,0,Math.PI*2,false,0);const tongueMesh=curved(tongue,tongueMat,.004);this.group.remove(tongueMesh);this.happy.add(tongueMesh);
    this.group.traverse(o=>{o.castShadow=false;o.receiveShadow=false;});
  }
  update(blink:number,happy:number,thought:number) {
    for(const eye of this.eyes) {
      const shut=Math.max(blink,happy);
      eye.pupil.scale.y=(1-shut*.94)*(1-thought*(eye.side>0?.17:-.08));
      eye.pupil.position.x=thought*-.003;
      eye.pupil.visible=shut<.9;eye.lid.visible=shut>=.9;
      eye.lid.scale.y=happy>.5?1:-.28;
    }
    this.smile.visible=happy<.5;this.happy.visible=happy>=.5;
    for(const patch of this.patches){const weight=Math.max(.15,happy);if(Math.abs(weight-patch.last)<.0005)continue;patch.last=weight;
      const p=patch.mesh.geometry.attributes.position;
      for(let i=0;i<p.count;i++){const x=patch.xy[i*3],y=patch.pivot+(patch.xy[i*3+1]-patch.pivot)*weight;p.setXYZ(i,x,y,this.surface(x,y)+patch.offset);}
      p.needsUpdate=true;patch.mesh.geometry.computeVertexNormals();
    }
  }
}
