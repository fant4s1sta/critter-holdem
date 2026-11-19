import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Protect the asset/controller contract: replacing a generated GLB with a new
// rig must not silently break hands, legs or facial animation at runtime.
for (const kind of ['pig', 'fox', 'tiger']) test(`${kind} GLB contains the complete game rig and nonempty facial controls`, () => {
  const bytes = readFileSync(new URL(`../../../public/models/${kind}/${kind}-rigged.glb`, import.meta.url));
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  const joints = new Set(gltf.skins[0].joints.map((i: number) => gltf.nodes[i].name));
  for (const bone of ['Head', ...['L', 'R'].flatMap(side =>
    ['Clavicle', 'Upperarm', 'Forearm', 'Hand', 'Mid1', 'Thigh', 'Calf', 'Foot', 'ToeBase'].map(part => `${side}_${part}`))]) {
    assert.ok(joints.has(bone), `missing controller bone: ${bone}`);
  }
  const mesh = gltf.meshes[0];
  const primitive = mesh.primitives[0];
  assert.ok(primitive.attributes.JOINTS_0 !== undefined);
  assert.ok(primitive.attributes.WEIGHTS_0 !== undefined);
  assert.ok(gltf.accessors[primitive.indices].count / 3 <= 15000);
  for (const name of ['blinkLeft', 'blinkRight', 'earLeft', 'earRight', 'cheekLift']) {
    const index = mesh.extras.targetNames.indexOf(name);
    assert.ok(index >= 0, `missing expression: ${name}`);
    const accessor = gltf.accessors[primitive.targets[index].POSITION];
    assert.equal(accessor.count, gltf.accessors[primitive.attributes.POSITION].count);
    assert.ok([...accessor.min, ...accessor.max].some(v => Math.abs(v) > .0001), `${name} must deform vertices`);
  }
  assert.ok(gltf.images.every((image: { uri?: string; bufferView?: number }) =>
    image.uri === undefined && image.bufferView !== undefined), 'textures must be embedded');
});
