import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { addCard } from './room';
import { PandaFace,faceSurface } from './face';

type PandaEmotion = 'natural' | 'happy' | 'thinking';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x,y,z);
const Q = () => new THREE.Quaternion();
const clamp = THREE.MathUtils.clamp;
const PANDA_GRIP = {cardY:.465,cardZ:.263,cardSpread:.052,cardWidth:.14,tipX:.122,tipY:.433,tipZ:.253};

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
export class PandaActor {
  readonly group = new THREE.Group();
  private readonly cards = new THREE.Group();
  private readonly skin: THREE.SkinnedMesh;
  private readonly head: THREE.Object3D;
  private readonly headRest: THREE.Quaternion;
  private readonly face: PandaFace;
  private readonly bones: Record<string, THREE.Object3D> = {};
  private readonly rests = new Map<THREE.Object3D,THREE.Quaternion>();
  private readonly poseRoot = new THREE.Group();
  private holdingBlend = 1;
  private holdingCards = true;
  private holdingInitialized = false;
  private happy = 0;
  private thought = 0;
  private readonly height = 2;
  constructor(source: THREE.Object3D, private readonly index: number) {
    const model=clone(source);this.group.add(this.poseRoot);this.poseRoot.add(model);this.poseRoot.scale.setScalar(this.height);this.poseRoot.position.y=.57;
    let skinned:THREE.SkinnedMesh|undefined;
    model.traverse(o=>{if((o as THREE.Bone).isBone)this.bones[o.name]=o;if((o as THREE.SkinnedMesh).isSkinnedMesh){skinned=o as THREE.SkinnedMesh;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    if(!skinned)throw new Error('熊猫模型缺少骨骼网格');this.skin=skinned;
    this.head=this.bones.tripoHead_0;
    if(!this.head)throw new Error('熊猫骨骼版本不匹配');
    this.headRest=this.head.quaternion.clone();
    for(const bone of Object.values(this.bones))this.rests.set(bone,bone.quaternion.clone());
    // Keep the shoulder close to its authored position. A small reach extension
    // avoids folding the generated shoulder seam sharply across the chest.
    for(const name of ['bone_10','bone_11','bone_14','bone_15'])this.bones[name].position.multiplyScalar(1.3);
    this.group.updateMatrixWorld(true);
    this.skin.skeleton.update();
    this.face = new PandaFace(faceSurface(this.skin.geometry));
    this.poseRoot.add(this.face.group);
    this.group.updateMatrixWorld(true);
    this.head.attach(this.face.group);
    this.poseRoot.add(this.cards);
    for (const side of [-1, 1]) {
      const card = addCard(this.cards, undefined, undefined, PANDA_GRIP.cardWidth);
      card.position.set(side * PANDA_GRIP.cardSpread, PANDA_GRIP.cardY, PANDA_GRIP.cardZ);
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
    // Move shoulders gently forward, then bend the short forearms around the cards.
    for(const side of [-1,1]) {
      const clavicle=this.bones[side===1?'tripo0_Left_Limb_1':'bone_12'];
      const upper=this.bones[side===1?'bone_9':'bone_13'];
      const elbow=this.bones[side===1?'bone_10':'bone_14'];
      const tip=this.bones[side===1?'bone_11':'bone_15'];
      aim(clavicle,upper,this.point(side*.14,.445,.034));
      const grip=this.holdingBlend;
      twoBone(upper,elbow,tip,this.point(
        side*THREE.MathUtils.lerp(.17,PANDA_GRIP.tipX,grip),
        THREE.MathUtils.lerp(.29,PANDA_GRIP.tipY,grip),
        THREE.MathUtils.lerp(.10,PANDA_GRIP.tipZ,grip),
      ),this.point(side*.27,THREE.MathUtils.lerp(.28,.34,grip),THREE.MathUtils.lerp(.06,.16,grip)));
      const hip=this.bones[side===1?'tripo1_Left_Limb_0':'tripo0_Right_Limb_0'];
      const knee=this.bones[side===1?'tripo1_Left_Limb_1':'tripo0_Right_Limb_1'];
      aim(hip,knee,this.point(side*.126,.153,.043));
    }
    this.headRest.copy(this.head.quaternion);
    this.group.updateWorldMatrix(true,true);
  }
  update(time:number,delta:number,emotion:PandaEmotion,still:boolean) {
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
    this.head.quaternion.copy(this.headRest).multiply(Q().setFromEuler(new THREE.Euler(nod,turn,tilt)));
    const cycle=(t+phase)%(4.1+this.index*.37);
    const blink=still?0:Math.pow(Math.max(0,1-Math.abs(cycle-.18)/.13),.55);
    const ear=(offset:number)=>still?0:Math.pow(Math.max(0,Math.sin(t*1.45+phase+offset)),12)*.72;
    const values={cheekLift:happy,earLeft:ear(0),earRight:ear(.65)};
    if(this.skin.morphTargetInfluences&&this.skin.morphTargetDictionary)for(const [key,v]of Object.entries(values))this.skin.morphTargetInfluences[this.skin.morphTargetDictionary[key]]=v;
    this.face.update(blink,happy,thought);
  }
}
