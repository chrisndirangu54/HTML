import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as collisionModule from '../../assets/js/robot-self-collision.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(process.env.ROBOT_THREE_ROOT || project, 'package.json'));
const THREE = await import(pathToFileURL(require.resolve('three')).href);
const { GLTFLoader } = await import(pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js')).href);
const { MeshoptDecoder } = await import(pathToFileURL(require.resolve('three/examples/jsm/libs/meshopt_decoder.module.js')).href);
const source = fs.readFileSync(path.join(project, 'assets/js/footer-robot.js'), 'utf8');
const motions = JSON.parse(fs.readFileSync(path.join(project, 'assets/models/robot-motions.json'), 'utf8'));
const bytes = fs.readFileSync(path.join(project, 'assets/models/sci-fi-ob-robot.glb'));
const length = bytes.readUInt32LE(12);
const gltfJSON = JSON.parse(bytes.subarray(20, 20 + length).toString());
// Use the real model geometry, skin and animations; only image/WebGL/DOM APIs
// are replaced so these behavioral tests run without a browser or GPU.
gltfJSON.materials = []; gltfJSON.images = []; gltfJSON.textures = [];
for (const mesh of gltfJSON.meshes) for (const primitive of mesh.primitives) delete primitive.material;
gltfJSON.extensionsRequired = gltfJSON.extensionsRequired.filter(name => name !== 'EXT_texture_webp');
gltfJSON.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };

async function fixture({ reduced = false, unavailable = false } = {}) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(gltfJSON), '');
  const listeners = new Map();
  const classes = new Set();
  const rect = { left: 100, top: 160, width: 850, height: 620 };
  const status = { textContent: '' };
  let frame, camera, mixer, resolveReady, rejectReady;
  let animate = true;
  let delta = 1 / 60;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const buttons = ['wave', 'backflip'].map(name => ({
    dataset: { robotAction: name }, disabled: true, attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, listener) { this[type] = listener; }
  }));
  const canvas = { addEventListener() {} };
  const stage = { getBoundingClientRect: () => rect };
  const root = {
    querySelector: selector => selector.includes('canvas') ? canvas : selector.includes('status') ? status : stage,
    querySelectorAll: () => buttons,
    classList: {
      add(name) { classes.add(name); if (name === 'is-loaded') resolveReady(); if (name === 'has-error') rejectReady(new Error('Robot load failed')); },
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }
    }
  };
  const window = {
    TTScenePolicy: { allowed: true },
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); }
  };
  const document = { getElementById: () => root, body: { classList: { contains: () => true } }, readyState: 'complete', hidden: false, addEventListener: window.addEventListener };
  class Renderer {
    debug = {};
    setPixelRatio() {} setSize() {}
    setAnimationLoop(callback) { frame = callback; }
    render(scene, c) { camera = c; scene.updateMatrixWorld(true); c.updateMatrixWorld(true); }
  }
  class Mixer extends THREE.AnimationMixer {
    constructor(model) { super(model); mixer = this; }
    update(dt) { return super.update(animate ? dt : 0); }
  }
  class Clock { elapsedTime = 0; getDelta() { return delta; } }
  const testThree = { ...THREE, WebGLRenderer: Renderer, AnimationMixer: Mixer, Clock, PMREMGenerator: class { fromScene() { return { texture: null }; } dispose() {} } };
  const patched = source.replace('import(THREE_URL)', 'Promise.resolve(testThree)')
    .replace('import(GLTF_LOADER_URL)', 'Promise.resolve(testLoader)')
    .replace('import(MESHOPT_URL)', 'Promise.resolve(testMeshopt)')
    .replace('import(ROOM_ENV_URL)', 'Promise.resolve(testRoom)')
    .replace('import(COLLISION_URL)', 'Promise.resolve(testCollision)');
  const fetch = async () => ({ ok: !unavailable, status: unavailable ? 503 : 200, json: async () => motions });
  new Function('testThree', 'testLoader', 'testMeshopt', 'testRoom', 'window', 'document', 'matchMedia', 'devicePixelRatio', 'fetch', 'testCollision', patched)(
    testThree, { GLTFLoader: class { setMeshoptDecoder() {} load(url, resolve) { resolve(gltf); } } },
    { MeshoptDecoder }, { RoomEnvironment: class {} }, window, document, () => ({ matches: reduced }), 1, fetch, collisionModule
  );
  await ready;
  const step = (count = 1) => { for (let i = 0; i < count; i++) frame(); };
  step();
  const emit = (type, event = {}) => { for (const listener of listeners.get(type) || []) listener(event); };
  const head = gltf.scene.getObjectByName('CC_Base_Head_033');
  const point = (x, y = 0, pointerType = 'mouse') => {
    const center = head.getWorldPosition(new THREE.Vector3()).project(camera);
    emit('pointermove', { pointerType, clientX: rect.left + (center.x + 1 + x) * rect.width / 2, clientY: rect.top + (1 - center.y + y) * rect.height / 2 });
  };
  const button = name => buttons.find(item => item.dataset.robotAction === name);
  return { model: gltf.scene, mixer, head, buttons, button, classes, status, rect, document, step, emit, point,
    action: name => mixer._actions.find(action => action.getClip().name === name),
    freeze: () => { animate = false; }, setDelta: value => { delta = value; },
    camera: () => camera
  };
}

test('baked clips target this exact robot and contain finite, valid joint tracks', async () => {
  assert.equal(motions.modelSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(motions.clips.map(clip => clip.name), ['wave', 'backflip']);
  assert.equal(new Set(motions.clips.map(clip => clip.uuid)).size, 2);
  assert(motions.clips.every(clip => typeof clip.uuid === 'string'));
  const names = new Set(gltfJSON.nodes.map(node => node.name));
  for (const json of motions.clips) {
    const clip = THREE.AnimationClip.parse(json);
    assert(clip.validate());
    assert(clip.duration > 2 && clip.duration < 5);
    for (const track of clip.tracks) {
      assert(names.has(track.name.split('.')[0]), `Unmapped track: ${track.name}`);
      assert(Array.from(track.values).every(Number.isFinite));
    }
  }
});

test('greeting, controls, single-play transitions and repeat playback', async () => {
  const r = await fixture();
  assert(r.buttons.every(button => !button.disabled));
  r.step(50);
  assert.equal(r.button('wave').attributes['aria-pressed'], 'true');
  assert(r.buttons.every(button => button.disabled));
  r.button('backflip').click(); // Even a programmatically dispatched click cannot interrupt.
  assert.equal(r.button('wave').attributes['aria-pressed'], 'true');
  r.step(320);
  assert(r.buttons.every(button => !button.disabled));
  assert(!r.classes.has('is-acting'));
  for (const name of ['backflip', 'wave', 'backflip']) {
    r.button(name).click(); r.step(30);
    assert.equal(r.button(name).attributes['aria-pressed'], 'true');
    r.step(330);
    assert(r.buttons.every(button => !button.disabled), `${name} did not return to idle`);
    assert(r.action(name).getEffectiveWeight() <= 0.00001);
  }
});

test('flip has a real airborne inversion, owns the head, and fits desktop/mobile', async () => {
  const r = await fixture();
  const hip = r.model.getObjectByName('CC_Base_Hip_02');
  const leftHand = r.model.getObjectByName('CC_Base_L_Hand_051');
  const rightHand = r.model.getObjectByName('CC_Base_R_Hand_070');
  const feet = ['CC_Base_L_Foot_045', 'CC_Base_R_Foot_016'].map(name => r.model.getObjectByName(name));
  for (const [width, height] of [[850, 620], [375, 420]]) {
    Object.assign(r.rect, { width, height }); r.emit('resize');
    r.point(1, -1); r.button('backflip').click();
    let inverted = false, airborne = false;
    for (let frame = 0; frame < 132; frame++) {
      r.step();
      const h = r.head.getWorldPosition(new THREE.Vector3());
      const pelvis = hip.getWorldPosition(new THREE.Vector3());
      inverted ||= h.y < pelvis.y - 0.2;
      airborne ||= feet.every(foot => foot.getWorldPosition(new THREE.Vector3()).y > 0);
      if (frame === 65) {
        const action = r.action('backflip');
        const track = action.getClip().tracks.find(track => track.name === `${r.head.name}.quaternion`);
        const authored = new THREE.Quaternion().fromArray(track.createInterpolant().evaluate(action.time)).normalize();
        assert(r.head.quaternion.angleTo(authored) < 0.0001, 'Cursor overrides backflip head pose');
      }
      for (const bone of [r.head, hip, leftHand, rightHand, ...feet]) {
        const projected = bone.getWorldPosition(new THREE.Vector3()).project(r.camera());
        assert(Math.abs(projected.x) < 0.94 && Math.abs(projected.y) < 0.94, `${width}px: ${bone.name} leaves frame`);
      }
    }
    assert(inverted && airborne, 'Backflip never becomes airborne and inverted');
    r.step(150);
    assert(r.buttons.every(button => !button.disabled));
  }
});

test('cursor tracking survives actions, scroll/resize, touch and pointer exit', async () => {
  const r = await fixture();
  r.button('wave').click(); r.point(1); r.step(75);
  const rightHand = r.model.getObjectByName('CC_Base_R_Hand_070');
  const shoulder = r.model.getObjectByName('CC_Base_R_Upperarm_062');
  assert(rightHand.getWorldPosition(new THREE.Vector3()).y > shoulder.getWorldPosition(new THREE.Vector3()).y, 'Wave does not raise the hand');
  r.step(300); r.freeze(); r.emit('blur'); r.step(120);
  const rest = r.head.quaternion.clone();
  const neutral = r.head.getWorldQuaternion(new THREE.Quaternion());
  for (const [x, y, axis, sign] of [[1, 0, 'y', 1], [-1, 0, 'y', -1], [0, -1, 'x', -1], [0, 1, 'x', 1]]) {
    r.emit('blur'); r.step(120); r.point(x, y); r.step(120);
    const offset = r.head.getWorldQuaternion(new THREE.Quaternion()).multiply(neutral.clone().invert());
    const angles = new THREE.Euler().setFromQuaternion(offset, 'YXZ');
    assert(angles[axis] * sign > 0.35, 'Wrong cursor-tracking direction');
  }
  const held = r.head.quaternion.clone(); r.step(2000);
  assert(r.head.quaternion.angleTo(held) < 0.0001, 'Look rotations accumulate');
  r.emit('pointerout', { relatedTarget: null }); r.step(120);
  assert(r.head.quaternion.angleTo(rest) < 0.0001);
  r.point(1, 1, 'touch'); r.step(120); assert(r.head.quaternion.angleTo(rest) < 0.0001);
  Object.assign(r.rect, { left: 10, top: -200, width: 375, height: 420 }); r.emit('resize'); r.step(); r.point(0); r.step(120);
  assert(r.head.quaternion.angleTo(rest) < 0.0001, 'Incorrect head origin after scroll/resize');
});

test('reduced motion and failed motion fetch keep actions inactive', async () => {
  const reduced = await fixture({ reduced: true });
  const rest = reduced.head.quaternion.clone();
  reduced.point(1, 1); reduced.button('backflip').click(); reduced.step(120);
  assert(reduced.buttons.every(button => button.disabled));
  assert(!reduced.classes.has('is-acting'));
  assert(reduced.head.quaternion.angleTo(rest) < 0.0001);
  const unavailable = await fixture({ unavailable: true });
  assert(unavailable.classes.has('is-loaded'));
  assert(unavailable.buttons.every(button => button.disabled));
  assert.match(unavailable.status.textContent, /unavailable/);
  unavailable.freeze(); unavailable.point(1); unavailable.step(120);
  assert(unavailable.head.quaternion.angleTo(rest) > 0.1, 'Asset failure breaks cursor tracking');
});

test('self-collision clears all motion clips without stretching or accumulating corrections', async () => {
  const { scene: model, animations } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(gltfJSON), '');
  const solver = collisionModule.createSelfCollision(model, THREE);
  const mixer = new THREE.AnimationMixer(model);
  const bones = [];
  model.traverse(bone => { if (bone.isBone) bones.push(bone); });
  let contacts = 0;
  let worstBefore = 0;
  let worstAfter = 0;
  for (const clip of [...motions.clips.map(data => THREE.AnimationClip.parse(data)), animations[0]]) {
    solver.restore(); mixer.stopAllAction();
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.play();
    for (let frame = 0; frame <= Math.floor(clip.duration * 60); frame++) {
      solver.restore(); action.paused = false; mixer.setTime(frame / 60);
      model.updateMatrixWorld(true);
      const authored = bones.map(bone => ({ position: bone.position.clone(), rotation: bone.quaternion.clone(), scale: bone.scale.clone() }));
      const before = solver.measure();
      solver.solve();
      const after = solver.measure();
      worstBefore = Math.max(worstBefore, before);
      worstAfter = Math.max(worstAfter, after);
      if (before > 0.003) contacts++;
      assert(after < 0.003, `${clip.name} at ${frame / 60}s: unresolved armour contact ${after}`);
      bones.forEach((bone, i) => {
        assert(bone.position.equals(authored[i].position), `${bone.name} was translated`);
        assert(bone.scale.equals(authored[i].scale), `${bone.name} was stretched`);
        assert(bone.quaternion.toArray().every(Number.isFinite));
      });
      const corrected = bones.map(bone => bone.quaternion.clone());
      solver.restore();
      bones.forEach((bone, i) => assert.deepEqual(bone.quaternion.toArray(), authored[i].rotation.toArray(), 'Correction leaked into animation'));
      solver.solve();
      bones.forEach((bone, i) => assert(bone.quaternion.clone().normalize().angleTo(corrected[i].clone().normalize()) < 0.0001, `${bone.name}: repeated solve drifts`));
    }
  }
  assert(contacts > 500, 'Did not exercise real collisions');
  assert(worstBefore > 0.1, 'Did not exercise a deep intersection');
  assert(worstAfter < worstBefore * 0.03, 'Collision resolution is ineffective');
});

test('self-collision follows rotated/scaled rigs and cursor-driven head poses', async () => {
  const { scene: model } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(gltfJSON), '');
  const solver = collisionModule.createSelfCollision(model, THREE);
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(THREE.AnimationClip.parse(motions.clips[0])).play();
  const head = model.getObjectByName('CC_Base_Head_033');
  for (const size of [0.3, 1, 2.5]) {
    for (const pitch of [-0.48, 0, 0.48]) {
      solver.restore(); model.scale.setScalar(size); model.rotation.set(0.7, -0.4, 1.8);
      action.paused = false; mixer.setTime(2.5);
      head.rotateX(pitch); head.rotateY(0.85);
      solver.solve();
      assert(solver.measure() < 0.003, 'Collision bounds do not follow rig/head transforms');
    }
  }
});


test('only the waving palm gets extra clearance, blended with the action', async () => {
  const r = await fixture();
  r.button('wave').click();
  for (let frame = 0; frame < 360; frame++) {
    r.step();
    const unit = r.model.getWorldScale(new THREE.Vector3()).x;
    const waist = r.model.getObjectByName('CC_Base_Waist_028').getWorldPosition(new THREE.Vector3());
    const chest = r.model.getObjectByName('CC_Base_Spine02_030').getWorldPosition(new THREE.Vector3());
    const neck = r.model.getObjectByName('CC_Base_NeckTwist01_031').getWorldPosition(new THREE.Vector3());
    const wave = r.action('wave');
    const weight = r.classes.has('is-acting') ? wave.getEffectiveWeight() : 0;
    if (weight <= 0) continue;
    const clearance = Math.sqrt(weight);
    const palmRadius = 0.075 + 0.055 * clearance;
    for (const [handName, fingerName] of [['CC_Base_R_Hand_070', 'CC_Base_R_Index3_076']]) {
      const wrist = r.model.getObjectByName(handName).getWorldPosition(new THREE.Vector3());
      const finger = r.model.getObjectByName(fingerName).getWorldPosition(new THREE.Vector3());
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const palm = wrist.clone().lerp(finger, t);
        for (const [a, b, radius] of [[waist, chest, 0.23 + 0.09 * clearance], [chest, neck, 0.26 + 0.08 * clearance]]) {
          const closest = new THREE.Line3(a, b).closestPointToPoint(palm, true, new THREE.Vector3());
          assert(palm.distanceTo(closest) / unit >= radius + palmRadius + 0.009,
            `${handName}: palm intersects torso at wave frame ${frame}`);
        }
      }
    }
  }
});


test('visible waving-hand skin stays outside torso collision volumes', async () => {
  const r = await fixture();
  const hand = r.model.getObjectByName('CC_Base_R_Hand_070');
  const descendants = new Set(); hand.traverse(joint => descendants.add(joint));
  const vertices = [];
  r.model.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const indices = mesh.geometry.getAttribute('skinIndex');
    const weights = mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < indices.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (descendants.has(mesh.skeleton.bones[indices.getComponent(i, j)])) weight += weights.getComponent(i, j);
      if (weight >= 0.5) vertices.push({ mesh, index: i });
    }
  });
  assert(vertices.length > 100, 'Test must inspect actual hand armour and fingers');
  r.button('wave').click();
  for (let frame = 0; frame < 240; frame++) {
    r.step();
    if (!r.classes.has('is-acting') || frame % 3) continue;
    const weight = Math.sqrt(r.action('wave').getEffectiveWeight());
    const unit = r.model.getWorldScale(new THREE.Vector3()).x;
    const waist = r.model.getObjectByName('CC_Base_Waist_028').getWorldPosition(new THREE.Vector3());
    const chest = r.model.getObjectByName('CC_Base_Spine02_030').getWorldPosition(new THREE.Vector3());
    const neck = r.model.getObjectByName('CC_Base_NeckTwist01_031').getWorldPosition(new THREE.Vector3());
    r.model.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); });
    for (const { mesh, index } of vertices) {
      const point = mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      for (const [a, b, radius] of [[waist, chest, 0.23 + 0.11 * weight], [chest, neck, 0.26 + 0.11 * weight]]) {
        const closest = new THREE.Line3(a, b).closestPointToPoint(point, true, new THREE.Vector3());
        assert(point.distanceTo(closest) / unit >= radius + 0.009 * weight,
          `Visible hand vertex ${index} enters torso at wave frame ${frame}`);
      }
    }
  }
});
