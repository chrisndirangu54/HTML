// Offline build: npm install --no-save --package-lock=false three@0.160.0
// node scripts/build-robot-motions.mjs [directory-containing-source-fbx-files]
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(process.env.ROBOT_THREE_ROOT || project, 'package.json'));
const THREE = await import(pathToFileURL(require.resolve('three')).href);
const { FBXLoader } = await import(pathToFileURL(require.resolve('three/examples/jsm/loaders/FBXLoader.js')).href);
const { GLTFLoader } = await import(pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js')).href);
const { MeshoptDecoder } = await import(pathToFileURL(require.resolve('three/examples/jsm/libs/meshopt_decoder.module.js')).href);
const revision = '7f134bc734557b1d9516cb476d25ea1f577e45c1';
const repository = 'https://huggingface.co/datasets/Linzhan/Mixamo-Animations-Characters';
const cache = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'tekntandao-robot-motions'));
await fs.mkdir(cache, { recursive: true });
const sources = {};

async function loadMotion(filename) {
  const url = `${repository}/resolve/${revision}/animation/${filename}`;
  const destination = path.join(cache, filename);
  let bytes;
  try { bytes = await fs.readFile(destination); } catch {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${filename}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(destination, bytes);
  }
  sources[filename] = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
  return new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

const bytes = await fs.readFile(path.join(project, 'assets/models/sci-fi-ob-robot.glb'));
const jsonLength = bytes.readUInt32LE(12);
const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
// Retarget the actual compressed geometry/skin, without a browser image decoder.
document.materials = []; document.images = []; document.textures = [];
for (const mesh of document.meshes) for (const primitive of mesh.primitives) delete primitive.material;
document.extensionsRequired = document.extensionsRequired.filter(name => name !== 'EXT_texture_webp');
document.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { scene: target } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(document), '');
const reference = await loadMotion('T-Pose.fbx');
const referenceMixer = new THREE.AnimationMixer(reference);
referenceMixer.clipAction(reference.animations[0]).play(); referenceMixer.update(0);
reference.updateMatrixWorld(true); target.updateMatrixWorld(true);

// CC has an extra pelvis, neck and twist joints. Match anatomical segments,
// rather than copying Mixamo's local quaternions onto different bone axes.
const mapping = [
  ['CC_Base_Hip_02', 'Hips', 'CC_Base_Waist_028', 'Spine'],
  ['CC_Base_Waist_028', 'Spine', 'CC_Base_Spine01_029', 'Spine1'],
  ['CC_Base_Spine01_029', 'Spine1', 'CC_Base_Spine02_030', 'Spine2'],
  ['CC_Base_Spine02_030', 'Spine2', 'CC_Base_NeckTwist01_031', 'Neck'],
  ['CC_Base_NeckTwist01_031', 'Neck', 'CC_Base_NeckTwist02_032', 'Head'],
  ['CC_Base_Head_033', 'Head'],
  ['CC_Base_L_Clavicle_044', 'LeftShoulder', 'CC_Base_L_Upperarm_046', 'LeftArm'],
  ['CC_Base_L_Upperarm_046', 'LeftArm', 'CC_Base_L_Forearm_047', 'LeftForeArm'],
  ['CC_Base_L_Forearm_047', 'LeftForeArm', 'CC_Base_L_Hand_051', 'LeftHand'],
  ['CC_Base_L_Hand_051', 'LeftHand', 'CC_Base_L_Index1_052', 'LeftHandIndex1'],
  ['CC_Base_R_Clavicle_061', 'RightShoulder', 'CC_Base_R_Upperarm_062', 'RightArm'],
  ['CC_Base_R_Upperarm_062', 'RightArm', 'CC_Base_R_Forearm_065', 'RightForeArm'],
  ['CC_Base_R_Forearm_065', 'RightForeArm', 'CC_Base_R_Hand_070', 'RightHand'],
  ['CC_Base_R_Hand_070', 'RightHand', 'CC_Base_R_Index1_074', 'RightHandIndex1'],
  ['CC_Base_L_Thigh_024', 'LeftUpLeg', 'CC_Base_L_Calf_035', 'LeftLeg'],
  ['CC_Base_L_Calf_035', 'LeftLeg', 'CC_Base_L_Foot_045', 'LeftFoot'],
  ['CC_Base_L_Foot_045', 'LeftFoot', 'CC_Base_L_ToeBase_067', 'LeftToeBase'],
  ['CC_Base_L_ToeBase_067', 'LeftToeBase'],
  ['CC_Base_R_Thigh_011', 'RightUpLeg', 'CC_Base_R_Calf_015', 'RightLeg'],
  ['CC_Base_R_Calf_015', 'RightLeg', 'CC_Base_R_Foot_016', 'RightFoot'],
  ['CC_Base_R_Foot_016', 'RightFoot', 'CC_Base_R_ToeBase_017', 'RightToeBase'],
  ['CC_Base_R_ToeBase_017', 'RightToeBase']
];
for (const [side, indices, thumbs] of [['L', ['052', '053', '054'], ['055', '057', '058']], ['R', ['074', '075', '076'], ['071', '072', '073']]]) {
  const prefix = side === 'L' ? 'Left' : 'Right';
  for (const [finger, suffixes] of [['Index', indices], ['Thumb', thumbs]]) {
    for (let i = 0; i < 3; i++) mapping.push([
      `CC_Base_${side}_${finger}${i + 1}_${suffixes[i]}`, `${prefix}Hand${finger}${i + 1}`,
      i < 2 ? `CC_Base_${side}_${finger}${i + 2}_${suffixes[i + 1]}` : null,
      i < 2 ? `${prefix}Hand${finger}${i + 2}` : null
    ]);
  }
}

const position = bone => bone.getWorldPosition(new THREE.Vector3());
const rotation = bone => bone.getWorldQuaternion(new THREE.Quaternion()).normalize();
const direction = (a, b) => position(b).sub(position(a)).normalize();
const bones = [];
target.traverse(bone => { if (bone.isBone) bones.push(bone); });
const rest = new Map(bones.map(bone => [bone.name, { position: bone.position.clone(), quaternion: bone.quaternion.clone().normalize(), scale: bone.scale.clone() }]));
const calibration = new Map(mapping.map(([name, sourceName, childName, sourceChildName]) => {
  const bone = target.getObjectByName(name);
  const sourceBone = reference.getObjectByName(`mixamorig${sourceName}`);
  if (!bone || !sourceBone) throw new Error(`Missing retarget joint: ${name} / ${sourceName}`);
  const aligned = rotation(bone);
  if (childName) aligned.premultiply(new THREE.Quaternion().setFromUnitVectors(
    direction(bone, target.getObjectByName(childName)),
    direction(sourceBone, reference.getObjectByName(`mixamorig${sourceChildName}`))
  ));
  return [name, { sourceName: sourceBone.name, correction: rotation(sourceBone).invert().multiply(aligned).normalize() }];
}));
const hip = target.getObjectByName('CC_Base_Hip_02');
const restHip = position(hip);
const sourceHipRest = position(reference.getObjectByName('mixamorigHips'));
const legLength = (rig, names) => position(rig.getObjectByName(names[0])).distanceTo(position(rig.getObjectByName(names[1]))) + position(rig.getObjectByName(names[1])).distanceTo(position(rig.getObjectByName(names[2])));
const translationScale = legLength(target, ['CC_Base_L_Thigh_024', 'CC_Base_L_Calf_035', 'CC_Base_L_Foot_045']) / legLength(reference, ['mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot']);

async function bake(name, filename) {
  const source = await loadMotion(filename);
  const clip = source.animations[0];
  const mixer = new THREE.AnimationMixer(source);
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true; action.play(); mixer.setTime(0); source.updateMatrixWorld(true);
  const sourceHip = source.getObjectByName('mixamorigHips');
  const firstHip = position(sourceHip);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation(sourceHip));
  const heading = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(forward.x, forward.z));
  mixer.setTime(clip.duration); source.updateMatrixWorld(true);
  const travel = position(sourceHip).sub(firstHip); travel.y = 0;
  const count = Math.round(clip.duration * 30) + 1;
  const times = Array.from({ length: count }, (_, i) => i * clip.duration / (count - 1));
  const data = new Map(bones.map(bone => [bone.name, { positions: [], rotations: [], scales: [] }]));
  for (const time of times) {
    action.paused = false; mixer.setTime(time); source.updateMatrixWorld(true);
    for (const bone of bones) {
      const original = rest.get(bone.name);
      bone.position.copy(original.position); bone.quaternion.copy(original.quaternion); bone.scale.copy(original.scale);
    }
    target.updateMatrixWorld(true);
    // Depth-first bones ensure each child's rotation uses its animated parent.
    for (const bone of bones) {
      const match = calibration.get(bone.name);
      if (match) {
        const desired = rotation(source.getObjectByName(match.sourceName)).premultiply(heading).multiply(match.correction);
        bone.quaternion.copy(rotation(bone.parent).invert().multiply(desired)).normalize();
      }
      if (bone === hip) {
        const displacement = position(sourceHip).sub(firstHip).addScaledVector(travel, -time / clip.duration);
        displacement.y = position(sourceHip).y - sourceHipRest.y;
        displacement.applyQuaternion(heading).multiplyScalar(translationScale).add(restHip);
        bone.position.copy(bone.parent.worldToLocal(displacement));
      }
      bone.updateWorldMatrix(false, false);
      const values = data.get(bone.name);
      const q = bone.quaternion.clone();
      if (values.rotations.length && q.dot(new THREE.Quaternion().fromArray(values.rotations, values.rotations.length - 4)) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      values.positions.push(...bone.position.toArray()); values.rotations.push(...q.toArray()); values.scales.push(...bone.scale.toArray());
    }
  }
  const tracks = [];
  for (const bone of bones) {
    const values = data.get(bone.name);
    tracks.push(new THREE.VectorKeyframeTrack(`${bone.name}.position`, times, values.positions), new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values.rotations), new THREE.VectorKeyframeTrack(`${bone.name}.scale`, times, values.scales));
  }
  const result = new THREE.AnimationClip(name, clip.duration, tracks).optimize();
  if (!result.validate()) throw new Error(`Invalid animation: ${name}`);
  mixer.stopAllAction();
  console.log(`${name}: ${count} frames, ${clip.duration.toFixed(2)}s, ${tracks.length} tracks`);
  const json = THREE.AnimationClip.toJSON(result);
  delete json.uuid;
  // AnimationClip.parse keeps this ID, and the mixer keys its actions by ID.
  // Give each clip a distinct, repeatable UUID rather than a random build ID.
  const hash = createHash('sha256').update(JSON.stringify(json)).digest('hex');
  json.uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  return json;
}

const clips = [await bake('wave', 'Waving.fbx'), await bake('backflip', 'Backflip_2.fbx')];
const output = {
  version: 1,
  model: 'sci-fi-ob-robot.glb',
  modelSha256: createHash('sha256').update(bytes).digest('hex'),
  source: { provider: 'Adobe Mixamo', mirror: repository, revision, files: sources },
  clips
};
const destination = path.join(project, 'assets/models/robot-motions.json');
await fs.writeFile(destination, JSON.stringify(output, (_, value) => typeof value === 'number' ? Number(value.toFixed(6)) : value) + '\n');
console.log(`Wrote ${destination}`);
