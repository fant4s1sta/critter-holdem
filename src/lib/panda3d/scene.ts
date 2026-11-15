import * as THREE from 'three';
import type { RoomPublicState, PublicPlayer, Card } from '../types';
import { liveSeatMap, chipBreakdown, CHIP_COLORS } from './live-state';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CritterActor } from './character';
import { CRITTERS, critterKindForSeat, type CritterKind } from '../critters';
import { addTable, addRoom, addChair, addCard, addChips, material, mesh, EIGHT_SEATS, seatsForPlayers, SEAT_SCALE, TABLE_Y, disposeRoomCaches } from './room';

export type PandaScene = { setRoom: (room: RoomPublicState) => void };
function disposeTree(root:THREE.Object3D) {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>materials.add(v));if((o as THREE.SkinnedMesh).isSkinnedMesh)(o as THREE.SkinnedMesh).skeleton.dispose();});
  materials.forEach(m=>{for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);m.dispose();});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());
}
export async function createPandaScene(host:HTMLElement,initialRoom:RoomPublicState,signal:AbortSignal):Promise<PandaScene> {
  signal.throwIfAborted();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio,1.5),2));renderer.setSize(440,780);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label','第一人称 3D 萌兽牌桌');host.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#35271e');scene.fog=new THREE.Fog('#372a20',18,35);
  const camera=new THREE.PerspectiveCamera(53,440/780,.1,45);
  const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(440,780,{type:THREE.HalfFloatType,samples:4}));
  const renderPass=new RenderPass(scene,camera),ao=new GTAOPass(scene,camera,440,780),output=new OutputPass();
  ao.updateGtaoMaterial({radius:.28,thickness:.6,distanceFallOff:1,samples:12,scale:1.3});ao.blendIntensity=.42;
  composer.addPass(renderPass);composer.addPass(ao);composer.addPass(output);
  // A supplied render target is NOT scaled by the constructor. Explicitly size
  // the entire chain; otherwise a 440px image is enlarged onto the retina canvas.
  composer.setSize(440,780);
  const resolution=renderer.getDrawingBufferSize(new THREE.Vector2());
  if(composer.readBuffer.width!==resolution.x||composer.readBuffer.height!==resolution.y)throw new Error('渲染分辨率不匹配');
  const pmrem=new THREE.PMREMGenerator(renderer),envScene=new RoomEnvironment();
  const env=pmrem.fromScene(envScene,.06);scene.environment=env.texture;scene.environmentIntensity=.32;envScene.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#ffe8c6','#71624e',.8));
  const key=new THREE.DirectionalLight('#ffe0ad',2.4);key.position.set(-3,7,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-5;key.shadow.camera.near=.1;key.shadow.camera.far=20;key.shadow.bias=-.0002;key.shadow.normalBias=.018;key.shadow.radius=3;scene.add(key);
  const fill=new THREE.DirectionalLight('#b9d9ec',1.05);fill.position.set(4,4,-4);scene.add(fill);
  const lamp=new THREE.PointLight('#ffca75',22,12,2);lamp.position.set(0,4.7,-1.1);scene.add(lamp);
  addRoom(scene);addTable(scene);
  const seatGroups=EIGHT_SEATS.map(s=>{const g=new THREE.Group();g.position.set(s.x,0,s.z);g.rotation.y=s.angle;g.scale.setScalar(SEAT_SCALE);scene.add(g);addChair(g);return g;});
  // Rest the cards flat on the felt, allowing only their thickness and a small clearance.
  const board=new THREE.Group();scene.add(board);
  const boardWidth=.68,boardSpacing=.75,boardLengthScale=1.8,boardRowGap=1.7;
  board.position.set(0,TABLE_Y+.009,.45);board.rotation.x=-Math.PI/2;
  // Compensate for the seated camera's foreshortening without tilting cards off the felt.
  board.scale.y=boardLengthScale;
  // First-person hand lives in the same scene, resting inside the near end of the rail.
  const own=new THREE.Group();scene.add(own);own.position.set(0,2.28,6.25);own.rotation.x=-.45;own.scale.setScalar(1.35);
  const ownCards = new THREE.Group();
  own.add(ownCards);
  const pawMat=material('#24282d',.86);
  for(const side of [-1,1]){const paw=mesh(own,new THREE.CapsuleGeometry(.16,.42,12,32),pawMat,[side*.37,-.3,.11]);paw.rotation.z=side*.3;paw.rotation.x=-.15;}
  const roster=new THREE.Group();scene.add(roster);
  let pool:CritterActor[]=[];let disposed=false,raf=0,time=0,last=performance.now();
  const cameraHome=new THREE.Vector3(0,6.4,10.5),targetHome=new THREE.Vector3(0,.95,.35),camPosition=cameraHome.clone();
  camera.position.copy(cameraHome);camera.lookAt(targetHome);
  let liveRoom=initialRoom;
  let liveMapping=liveSeatMap(initialRoom);
  let liveSignature='';
  const labels=Array.from({length:7},()=>{const el=document.createElement('div');el.className='panda-seat-label';el.hidden=true;host.append(el);return el;});
  const suits:Record<Card['suit'],string>={s:'♠',h:'♥',d:'♦',c:'♣'};
  const clearCards=(g:THREE.Group)=>{for(const child of [...g.children]){child.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat instanceof THREE.MeshStandardMaterial&&!mat.map)mat.dispose();}});g.remove(child);}};
  const wagerGroup=new THREE.Group();scene.add(wagerGroup);
  const drawWager=(player:PublicPlayer|undefined,index:number)=>{
    if (!player) return;
    const stacks = chipBreakdown(player.totalBetChips);
    if (stacks.length === 0) return;
    const group=new THREE.Group();wagerGroup.add(group);
    const seat = index < 0 ? undefined : seatsForPlayers(liveMapping.layout)[index];
    if (seat) {
      group.rotation.y = liveMapping.layout === 8 && (index === 1 || index === 3)
        ? (index === 1 ? -1 : 1) * THREE.MathUtils.degToRad(15) : 0;
      group.position.set(seat.x === 0 ? 0 : Math.sign(seat.x) * (seat.z < -2 ? 1.13 : 1.3),
        TABLE_Y, seat.x === 0 ? -2.25 : Math.max(-1.3, seat.z + .25));
    } else {
      group.position.set(0, TABLE_Y, 3.8);
    }
    const alongEdge=index>=0&&index!==2;
    stacks.forEach(({value,count,slot})=>{
      // Each denomination owns a permanent slot, even when other slots are empty.
      const offset=(slot-2)*.32;
      const color=CHIP_COLORS[slot];
      const pile=addChips(group,alongEdge?0:offset,alongEdge?offset:0,Math.min(count,8),color,value);
      pile.scale.set(1.42,1.15,1.42);
    });
  };
  const setRoom=(room:RoomPublicState)=>{
    liveRoom = room;
    liveMapping = liveSeatMap(room);
    const signature=JSON.stringify([room.game?.communityCards,room.players.map(p=>[p.id,p.seat,p.totalBetChips,p.folded,p.holeCards]),room.you.playerId]);
    if(signature===liveSignature)return;liveSignature=signature;
    // Actors belong to absolute room seats, not screen slots. Adding another
    // player or changing the viewer must not swap an existing player's animal.
    pool.forEach(actor=>{actor.group.visible=false;roster.add(actor.group);});
    liveMapping.opponents.forEach((player,i)=>{
      const actor=player?pool[player.seat]:undefined;
      if(actor){seatGroups[i].add(actor.group);actor.group.visible=true;}
    });
    pawMat.color.set(CRITTERS[critterKindForSeat(liveMapping.foreground?.seat??0)].pawColor);
    clearCards(board);
    (room.game?.communityCards??[]).forEach((card,i)=>{
      const model=addCard(board,card.rank==='T'?'10':card.rank,suits[card.suit],boardWidth);
      model.position.set(i<3?(i-1)*boardSpacing:(i-3.5)*boardSpacing,i<3?0:-boardRowGap/boardLengthScale,0);
    });
    clearCards(ownCards);
    const me=liveMapping.me;
    if(me&&!me.folded)(me.holeCards??[]).forEach((card,i)=>{
      const side=i===0?-1:1;const c=addCard(ownCards,card.rank==='T'?'10':card.rank,suits[card.suit],.55);
      c.position.set(side*.23,.1,i===1?.026:0);c.rotation.z=-side*.12;
    });
    disposeTree(wagerGroup);wagerGroup.clear();
    liveMapping.opponents.forEach((player,i)=>drawWager(player,i));drawWager(liveMapping.foreground,-1);
  };
  const cameraGoal = cameraHome.clone();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const frame=()=>{
    if(disposed)return;raf=requestAnimationFrame(frame);const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
    if(document.hidden)return;
    if (!reduced.matches) time += dt;
    const seats = seatsForPlayers(liveMapping.layout);
    cameraGoal.z = liveMapping.layout === 8 ? 11.6 : 10.5;
    camPosition.lerp(cameraGoal, reduced.matches ? 1 : 1 - Math.exp(-dt * 6));
    camera.position.copy(camPosition);
    camera.lookAt(targetHome);
    // The near row is magnified more by perspective. Compensate in the table
    // plane (depth foreshortening is quadratic), without tilting cards upward.
    camera.updateMatrixWorld();
    const farDepth=-new THREE.Vector3(0,board.position.y,board.position.z).applyMatrix4(camera.matrixWorldInverse).z;
    const nearDepth=-new THREE.Vector3(0,board.position.y,board.position.z+boardRowGap).applyMatrix4(camera.matrixWorldInverse).z;
    const rowScale=THREE.MathUtils.clamp(nearDepth/farDepth,.65,1);
    board.children.forEach((card,i)=>{
      if(i<3)return;
      card.scale.set(rowScale*1.06,rowScale*rowScale*1.06,1);
      card.position.x=(i-3.5)*boardSpacing*rowScale*1.06;
    });
    own.visible = !!(liveMapping.me?.holeCards?.length && !liveMapping.me.folded);
    // Keep the forearms above the rail; move forward with the wider eight-seat camera.
    own.position.z=6.25+(camPosition.z-cameraHome.z)*(.65/1.1);
    seatGroups.forEach((group, index) => {
      const seat = seats[index];
      group.visible = !!seat && !!liveMapping.opponents[index];
      if (!seat) return;
      group.position.set(seat.x, 0, seat.z);
      group.rotation.y = seat.angle;
    });
    liveMapping.opponents.forEach(player=>{
      if(!player)return;
      const actor=pool[player.seat];
      actor.setHoldingCards(!!(player?.holeCardCount && !player.folded));
      const won=liveRoom.game?.winners?.some(w=>w.playerId===player?.id);
      actor.update(time, dt, won ? 'happy' : player?.id === liveRoom.game?.actingPlayerId ? 'thinking' : 'natural', reduced.matches);
    });
    labels.forEach((el,i)=>{
      const player=liveMapping.opponents[i],seat=seats[i];el.hidden=!player||!seat;
      if(!player||!seat)return;
      // Anchor each compact name just above its own character's ears.
      const point=new THREE.Vector3(seat.x,2.78,seat.z).project(camera);
      const sideSeat=i===0||i===4||(liveMapping.layout===8&&(i===5||i===6));
      const x=THREE.MathUtils.clamp((point.x+1)*220,36,404)+(sideSeat?Math.sign(seat.x)*10:0);
      el.style.maxWidth=sideSeat?"48px":"90px";
      el.style.transform=`translate(-50%,-100%) translate(${x}px,${(1-point.y)*390-5}px)`;
      el.dataset.acting=String(player.id===liveRoom.game?.actingPlayerId);
      el.title=player.name;
      if(el.textContent!==player.name)el.textContent=player.name;
    });
    composer.render();
  };
  const dispose=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);signal.removeEventListener('abort',dispose);labels.forEach(el=>el.remove());disposeTree(scene);key.shadow.dispose();ao.dispose();output.dispose();composer.dispose();env.dispose();renderer.dispose();renderer.domElement.remove();disposeRoomCaches();};
  signal.addEventListener('abort',dispose,{once:true});
  try {
    // Settle every load so a failure or abort cannot leak another model.
    const kinds=Object.keys(CRITTERS) as CritterKind[];
    const loaded=await Promise.allSettled(kinds.map(kind=>new GLTFLoader().loadAsync(CRITTERS[kind].model)));
    const failed=loaded.find(r=>r.status==='rejected');
    if(disposed||failed){
      loaded.forEach(r=>{if(r.status==='fulfilled')disposeTree(r.value.scene);});
      signal.throwIfAborted();
      if(failed?.status==='rejected')throw failed.reason;
    }
    const models=Object.fromEntries(loaded.map((r,i)=>{if(r.status==='rejected')throw r.reason;return [kinds[i],r.value.scene];})) as Record<CritterKind,THREE.Group>;
    // Keep the source resources in the disposal tree, but never render T-poses.
    Object.values(models).forEach(model=>{model.visible=false;scene.add(model);});
    // Neutralize the warm pigment baked into this panda's albedo only.
    // Preserve texture detail and scene lighting; dark patches remain charcoal.
    const pandaMaterials=new Set<THREE.MeshStandardMaterial>();
    models.panda.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)for(const mat of Array.isArray(m.material)?m.material:[m.material])if(mat instanceof THREE.MeshStandardMaterial)pandaMaterials.add(mat);});
    pandaMaterials.forEach(mat=>{
      mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float pandaLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float pandaWhite = smoothstep(0.16, 0.5, pandaLuma);
        float pandaTone = pandaLuma * mix(0.42, 1.08, pandaWhite);
        diffuseColor.rgb = vec3(pandaTone) * vec3(0.94, 1.0, 1.12);
      `);};
      mat.customProgramCacheKey=()=> 'panda-neutral-black-white-v1';mat.needsUpdate=true;
    });
    pool=Array.from({length:8},(_,seat)=>{
      const kind=critterKindForSeat(seat);
      const actor=new CritterActor(models[kind],seat,kind);
      roster.add(actor.group);return actor;
    });
    setRoom(initialRoom);
    frame();
  }catch(e){dispose();throw e;}
  return { setRoom };
}
