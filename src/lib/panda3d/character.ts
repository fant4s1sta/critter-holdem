import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { addCard } from './room';
import { PandaFace,faceSurface } from './face';
import type { CritterKind } from '../critters';

type CritterEmotion = 'natural' | 'happy' | 'thinking';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x,y,z);
const Q = () => new THREE.Quaternion();
const clamp = THREE.MathUtils.clamp;
const PANDA_GRIP = {cardY:.465,cardZ:.263,cardSpread:.052,cardWidth:.14,tipX:.122,tipY:.433,tipZ:.253};

// Wrists sit outside the lower card edges; the hooves turn upward to grip them.
const PIG_GRIP = {cardY:.465,cardZ:.275,cardSpread:.052,cardWidth:.14,tipX:.123,tipY:.415,tipZ:.29};

/** Aim a bone in world space without assuming the generated rig's local axes. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
  bone.updateWorldMatrix(true,true);
  const p=bone.getWorldPosition(V()), from=child.getWorldPosition(V()).sub(p).normalize(), to=target.clone().sub(p).normalize();
  const desired=Q().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(Q()));
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(Q()).invert().multiply(desired));
  bone.updateWorldMatrix(false,true);
}
function twoBone(upper: THREE.Object3D, elbow: THREE.Object3D, tip: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3) {
  const a=upper.getWorldPosition(V()), b=elbow.getWorldPosition(V()), c=tip.getWorldPosition(V());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),direction=target.clone().sub(a);const d=clamp(direction.length(),.001,l1+l2-.0001);direction.normalize();
  const h=(l1*l1-l2*l2+d*d)/(2*d), height=Math.sqrt(Math.max(0,l1*l1-h*h));
  const bend=pole.clone().sub(a);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
  const elbowTarget=a.clone().addScaledVector(direction,h).addScaledVector(bend,height);
  aim(upper,elbow,elbowTarget);aim(elbow,tip,target);
}
export class CritterActor {
  readonly group = new THREE.Group();
  private readonly cards = new THREE.Group();
  private readonly skin: THREE.SkinnedMesh;
  private readonly head: THREE.Object3D;
  private readonly face: PandaFace | null;
  private readonly grip: typeof PANDA_GRIP;
  private readonly bones: Record<string, THREE.Object3D> = {};
  private readonly rests = new Map<THREE.Object3D,THREE.Quaternion>();
  private readonly poseRoot = new THREE.Group();
  private holdingBlend = 1;
  private holdingCards = true;
  private holdingInitialized = false;
  private happy = 0;
  private thought = 0;
  private readonly height = 2;
  constructor(source: THREE.Object3D, private readonly index: number, readonly kind: CritterKind = 'panda', private readonly stance: 'seated' | 'hero' = 'seated') {
    this.grip = kind === 'pig'
      ? { ...PIG_GRIP, tipX: .142, tipY: .391, tipZ: .266 }
      : kind === 'panda' ? PANDA_GRIP : PIG_GRIP;
    const model=clone(source);model.visible=true;this.group.add(this.poseRoot);this.poseRoot.add(model);this.poseRoot.scale.setScalar(this.height);this.poseRoot.position.y=.57;
    let skinned:THREE.SkinnedMesh|undefined;
    model.traverse(o=>{if((o as THREE.Bone).isBone)this.bones[o.name]=o;if((o as THREE.SkinnedMesh).isSkinnedMesh){skinned=o as THREE.SkinnedMesh;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    if(!skinned)throw new Error(`${kind} 模型缺少骨骼网格`);this.skin=skinned;
    this.head=this.bones[kind!=='panda'?'Head':'tripoHead_0'];
    if(!this.head)throw new Error(`${kind} 骨骼版本不匹配`);
    for(const bone of Object.values(this.bones))this.rests.set(bone,bone.quaternion.clone());
    // Both generated rigs need enough reach for a bent-arm grip. Without this
    // extension the short-arm IK target is unreachable and the cards appear to float.
    if(stance==='seated')for(const name of kind!=='panda'?['L_Forearm','L_Hand','R_Forearm','R_Hand']:['bone_10','bone_11','bone_14','bone_15'])this.bones[name].position.multiplyScalar(1.3);
    this.group.updateMatrixWorld(true);
    // Bring the short legs over the cushion's front edge. Moving the hip
    // roots keeps the torso/card grip fixed instead of lifting the whole actor.
    if(stance==='seated')for(const name of kind!=='panda'?['L_Thigh','R_Thigh']:['tripo1_Left_Limb_0','tripo0_Right_Limb_0']){
      const hip=this.bones[name];
      const p=this.poseRoot.worldToLocal(hip.getWorldPosition(V()));
      p.y+=kind!=='panda'?.04:.02;p.z+=.11;
      hip.position.copy(hip.parent!.worldToLocal(this.poseRoot.localToWorld(p)));
    }
    this.group.updateMatrixWorld(true);
    this.skin.skeleton.update();
    this.face = kind==='panda'?new PandaFace(faceSurface(this.skin.geometry)):null;
    if(this.face){
      this.poseRoot.add(this.face.group);
      this.group.updateMatrixWorld(true);
      this.head.attach(this.face.group);
    }
    this.poseRoot.add(this.cards);
    for (const side of [-1, 1]) {
      const card = addCard(this.cards, undefined, undefined, this.grip.cardWidth);
      card.position.set(side * this.grip.cardSpread, this.grip.cardY, this.grip.cardZ);
      card.rotation.set(-.08, side * -.06, side * -.12);
    }
    this.pose();
  }
  private point(x:number,y:number,z:number) {return this.poseRoot.localToWorld(V(x,y,z));}
  setHoldingCards(holding:boolean) {
    this.holdingCards=holding;
    this.cards.visible=holding;
    if(!this.holdingInitialized){this.holdingInitialized=true;this.holdingBlend=holding?1:0;this.pose();}
  }
  private pose() {
    for(const [b,q]of this.rests)b.quaternion.copy(q);
    this.group.updateWorldMatrix(true,true);
    const biped=this.kind!=='panda',grip=this.holdingBlend;
    for(const side of [-1,1]) {
      const prefix=side===1?'L':'R';
      const [clavicle,upper,elbow,hand]=(biped
        ? [`${prefix}_Clavicle`,`${prefix}_Upperarm`,`${prefix}_Forearm`,`${prefix}_Hand`]
        : side===1?['tripo0_Left_Limb_1','bone_9','bone_10','bone_11']:['bone_12','bone_13','bone_14','bone_15']
      ).map(name=>this.bones[name]);
      if(this.stance==='hero'){
        // A relaxed hands-on-hips stance; the original straight legs stay intact.
        aim(clavicle,upper,this.point(side*.17,.47,.015));
        twoBone(upper,elbow,hand,this.point(side*.14,.36,.11),this.point(side*.30,.39,.025));
        if(biped)aim(hand,this.bones[`${prefix}_Mid1`],this.point(side*.13,.30,.14));
        continue;
      }
      aim(clavicle,upper,this.point(side*(biped?.19:.14),biped?.44:.445,biped?.035:.034));
      twoBone(upper,elbow,hand,this.point(
        side*THREE.MathUtils.lerp(biped?.19:.17,this.grip.tipX,grip),
        THREE.MathUtils.lerp(.29,this.grip.tipY,grip),
        THREE.MathUtils.lerp(biped?.13:.10,this.grip.tipZ,grip),
      ),this.point(side*(biped?.31:.27),biped?.34:THREE.MathUtils.lerp(.28,.34,grip),biped?.13:THREE.MathUtils.lerp(.06,.16,grip)));
      if(biped){
        aim(hand,this.bones[`${prefix}_Mid1`],this.point(side*THREE.MathUtils.lerp(.06,.13,grip),THREE.MathUtils.lerp(.27,.49,grip),THREE.MathUtils.lerp(.17,.285,grip)));
        const hip=this.bones[`${prefix}_Thigh`],knee=this.bones[`${prefix}_Calf`],foot=this.bones[`${prefix}_Foot`];
        aim(hip,knee,this.point(side*.14,.16,.24));
        aim(knee,foot,this.point(side*.14,.07,.28));
        aim(foot,this.bones[`${prefix}_ToeBase`],this.point(side*.14,.07,.36));
      }else{
        const hip=this.bones[side===1?'tripo1_Left_Limb_0':'tripo0_Right_Limb_0'];
        const knee=this.bones[side===1?'tripo1_Left_Limb_1':'tripo0_Right_Limb_1'];
        aim(hip,knee,this.point(side*.14,.16,.26));
      }
    }
    this.group.updateWorldMatrix(true,true);
  }
  update(time:number,delta:number,emotion:CritterEmotion,still:boolean) {
    const target=this.holdingCards?1:0;
    if(Math.abs(this.holdingBlend-target)>.0001){
      this.holdingBlend=still?target:THREE.MathUtils.damp(this.holdingBlend,target,10,delta);
      if(Math.abs(this.holdingBlend-target)<.0001)this.holdingBlend=target;
      this.pose();
    }
    const t=still?0:time,phase=this.index*1.71;
    const happy = this.happy = THREE.MathUtils.damp(this.happy, emotion === 'happy' ? 1 : 0, 8, delta);
    const thought = this.thought = THREE.MathUtils.damp(this.thought, emotion === 'thinking' ? 1 : 0, 8, delta);
    const breath=still?0:Math.sin(t*1.65+phase);
    this.poseRoot.position.y=.57+breath*.006;
    this.poseRoot.scale.set(this.height*(1+breath*.0018),this.height*(1+breath*.0025),this.height*(1+breath*.003));
    // Body and cards breathe together; independent head motion never pulls the grip apart.
    const nod=(still?0:Math.sin(t*.65+phase)*.013)+thought*.035-happy*.025;
    const turn=still?0:Math.sin(t*.41+phase)*.035;
    const tilt=(still?0:Math.sin(t*.52+phase)*.014)+thought*.055;
    this.head.quaternion.copy(this.rests.get(this.head)!).multiply(Q().setFromEuler(new THREE.Euler(nod,turn,tilt)));
    const cycle=(t+phase)%(4.1+this.index*.37);
    const blink=still?0:Math.pow(Math.max(0,1-Math.abs(cycle-.18)/.13),.55);
    const ear=(offset:number)=>still?0:Math.pow(Math.max(0,Math.sin(t*1.45+phase+offset)),12)*.72;
    const values={cheekLift:happy,earLeft:ear(0),earRight:ear(.65),blinkLeft:Math.max(blink,happy*.82,thought*.15),blinkRight:Math.max(blink,happy*.82)};
    if(this.skin.morphTargetInfluences&&this.skin.morphTargetDictionary)for(const [key,v]of Object.entries(values)){const index=this.skin.morphTargetDictionary[key];if(index!==undefined)this.skin.morphTargetInfluences[index]=v;}
    this.face?.update(blink,happy,thought);
  }
}

export function neutralizePanda(source: THREE.Object3D) {
    // Neutralize the warm pigment baked into this panda's albedo only.
    // Preserve texture detail and scene lighting; dark patches remain charcoal.
    const pandaMaterials=new Set<THREE.MeshStandardMaterial>();
    source.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)for(const mat of Array.isArray(m.material)?m.material:[m.material])if(mat instanceof THREE.MeshStandardMaterial)pandaMaterials.add(mat);});
    pandaMaterials.forEach(mat=>{
      mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float pandaLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float pandaWhite = smoothstep(0.16, 0.5, pandaLuma);
        float pandaTone = pandaLuma * mix(0.42, 1.08, pandaWhite);
        diffuseColor.rgb = vec3(pandaTone) * vec3(0.94, 1.0, 1.12);
      `);};
      mat.customProgramCacheKey=()=> 'panda-neutral-black-white-v1';mat.needsUpdate=true;
    });
}
