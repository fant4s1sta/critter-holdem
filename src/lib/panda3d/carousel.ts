import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CRITTERS, CRITTER_KINDS, type CritterKind } from '../critters';
import { CritterActor, neutralizePanda } from './character';

/** Lightweight model-only preview; each animal uses the game's actual rig and pose. */
export async function createCritterCarousel(host: HTMLElement, initial: CritterKind, signal: AbortSignal) {
  signal.throwIfAborted();
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 30);
  camera.position.set(0, 1.9, 4.8); camera.lookAt(0, 1.03, 0);
  scene.add(new THREE.HemisphereLight('#fff1d4', '#647d67', 2));
  const key = new THREE.DirectionalLight('#fff3df', 3); key.position.set(-3, 5, 4); scene.add(key);
  const ring = new THREE.Group(); ring.position.z = -2.1; scene.add(ring);
  const step = Math.PI * 2 / CRITTER_KINDS.length;
  let target = -CRITTER_KINDS.indexOf(initial) * step;
  ring.rotation.y = target;
  const actors: CritterActor[] = [];
  let frame = 0, disposed = false, last = performance.now(), time = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const collect = (root: THREE.Object3D) => root.traverse(object => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
    if (!(object instanceof THREE.Mesh)) return;
    geometry.add(object.geometry);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  const resize = () => {
    const width = host.clientWidth, height = host.clientHeight;
    camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); renderer.setSize(width, height);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const dispose = () => {
    if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect(); signal.removeEventListener('abort', dispose);
    collect(scene); geometry.forEach(v => v.dispose()); materials.forEach(v => v.dispose()); textures.forEach(v => v.dispose());
    renderer.dispose(); renderer.domElement.remove();
  };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const loaded = await Promise.allSettled(CRITTER_KINDS.map(kind => new GLTFLoader().loadAsync(CRITTERS[kind].model)));
    // Attach every successful load before cleanup, including partial load failures.
    for (const result of loaded) if (result.status === 'fulfilled') { result.value.scene.visible = false; scene.add(result.value.scene); }
    if (disposed) {
      collect(scene); geometry.forEach(v => v.dispose()); materials.forEach(v => v.dispose()); textures.forEach(v => v.dispose()); signal.throwIfAborted();
    }
    const failed = loaded.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    loaded.forEach((result, index) => {
      if (result.status !== 'fulfilled') return;
      if (CRITTER_KINDS[index] === 'panda') neutralizePanda(result.value.scene);
      const actor = new CritterActor(result.value.scene, index, CRITTER_KINDS[index], 'hero');
      actor.setHoldingCards(false);
      actor.group.position.set(Math.sin(index * step) * 2.1, -.57, Math.cos(index * step) * 2.1);
      ring.add(actor.group); actors.push(actor);
    });
    const animate = () => {
      if (disposed) return;
      const now = performance.now(), delta = Math.min((now - last) / 1000, .05); last = now; time += delta;
      ring.rotation.y = reduced.matches ? target : THREE.MathUtils.damp(ring.rotation.y, target, 10, delta);
      actors.forEach(actor => { actor.group.rotation.y = -ring.rotation.y; actor.update(time, delta, 'natural', reduced.matches); });
      renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    animate();
  } catch (error) { dispose(); throw error; }
  return { select(kind: CritterKind) {
    const desired = -CRITTER_KINDS.indexOf(kind) * step;
    target += THREE.MathUtils.euclideanModulo(desired - target + Math.PI, Math.PI * 2) - Math.PI;
  } };
}
