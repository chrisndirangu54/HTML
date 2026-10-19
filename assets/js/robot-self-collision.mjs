// Rotation-only, post-animation self-collision constraints for the footer rig.
// Capsules approximate the armour; adjacent joints are deliberately excluded.
export function createSelfCollision(model, THREE) {
  const bone = name => model.getObjectByName(name);
  const hip = bone('CC_Base_Hip_02');
  const waist = bone('CC_Base_Waist_028');
  const chest = bone('CC_Base_Spine02_030');
  const neck = bone('CC_Base_NeckTwist01_031');
  const head = bone('CC_Base_Head_033');
  const leftShoulder = bone('CC_Base_L_Upperarm_046');
  const rightShoulder = bone('CC_Base_R_Upperarm_062');
  const definitions = [
    ['leftArm', 1, 'CC_Base_L_Upperarm_046', 'CC_Base_L_Forearm_047', 'CC_Base_L_Hand_051', 'CC_Base_L_Index3_054'],
    ['rightArm', -1, 'CC_Base_R_Upperarm_062', 'CC_Base_R_Forearm_065', 'CC_Base_R_Hand_070', 'CC_Base_R_Index3_076'],
    ['leftLeg', 1, 'CC_Base_L_Thigh_024', 'CC_Base_L_Calf_035', 'CC_Base_L_Foot_045', 'CC_Base_L_ToeBase_067'],
    ['rightLeg', -1, 'CC_Base_R_Thigh_011', 'CC_Base_R_Calf_015', 'CC_Base_R_Foot_016', 'CC_Base_R_ToeBase_017']
  ];
  if (![hip, waist, chest, neck, head, leftShoulder, rightShoulder].every(Boolean)) return { restore() {}, solve() {}, measure: () => 0 };
  const limbs = definitions.map(([name, side, ...names]) => ({
    name, side, arm: name.endsWith('Arm'), bones: names.map(bone),
    points: names.map(() => new THREE.Vector3())
  })).filter(limb => limb.bones.every(Boolean));
  const controlled = limbs.flatMap(limb => limb.bones.slice(0, 2)).map(joint => ({
    bone: joint, animated: joint.quaternion.clone(),
    // Large corrections would destroy the authored motion, so cap the swing.
    limit: THREE.MathUtils.degToRad(75)
  }));
  const states = new Map(controlled.map(state => [state.bone, state]));
  const scale = new THREE.Vector3();
  const positions = [hip, waist, chest, neck, head].map(() => new THREE.Vector3());
  const headOffset = new THREE.Vector3(0, 12, 2);
  const sideways = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  const inverseParent = new THREE.Quaternion();
  const delta = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  const jointPosition = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const sample = new THREE.Vector3();
  const target = new THREE.Vector3();
  const segment = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const separation = new THREE.Vector3();
  const proximalEnd = new THREE.Vector3();
  let unit = 1;
  let hasPose = false;
  const colliders = [];

  function refresh() {
    model.updateWorldMatrix(true, true);
    unit = Math.max(Math.abs(model.getWorldScale(scale).x), 1e-8);
    [hip, waist, chest, neck].forEach((joint, i) => joint.getWorldPosition(positions[i]));
    positions[4].copy(headOffset); head.localToWorld(positions[4]);
    // Shoulder separation supplies a stable outward direction even upside down.
    sideways.copy(leftShoulder.getWorldPosition(from)).sub(rightShoulder.getWorldPosition(to)).normalize();
    colliders.length = 0;
    colliders.push(
      { a: positions[0], b: positions[1], radius: 0.21 * unit, kind: 'pelvis' },
      { a: positions[1], b: positions[2], radius: 0.23 * unit, kind: 'torso' },
      { a: positions[2], b: positions[3], radius: 0.26 * unit, kind: 'chest' },
      { a: positions[4], b: positions[4], radius: 0.18 * unit, kind: 'head' }
    );
    limbs.forEach(updateLimb);
  }

  function updateLimb(limb) {
    limb.bones.forEach((joint, i) => joint.getWorldPosition(limb.points[i]));
  }

  function penetration(point, radius, collider, side) {
    segment.subVectors(collider.b, collider.a);
    const length = segment.lengthSq();
    const t = length > 1e-12 ? THREE.MathUtils.clamp(separation.subVectors(point, collider.a).dot(segment) / length, 0, 1) : 0;
    closest.copy(collider.a).addScaledVector(segment, t);
    separation.subVectors(point, closest);
    const distance = separation.length();
    const depth = radius + collider.radius + 0.012 * unit - distance;
    if (depth <= 0) return 0;
    if (distance > 1e-8) separation.multiplyScalar(1 / distance);
    else separation.copy(sideways).multiplyScalar(side);
    target.copy(point).addScaledVector(separation, depth);
    return depth;
  }

  function rotateOut(joint, point) {
    joint.getWorldPosition(jointPosition);
    from.subVectors(point, jointPosition);
    to.subVectors(target, jointPosition);
    if (from.lengthSq() < 1e-12 || to.lengthSq() < 1e-12) return;
    delta.setFromUnitVectors(from.normalize(), to.normalize());
    const angle = identity.angleTo(delta);
    if (angle > 0.18) delta.slerp(identity, 1 - 0.18 / angle);
    joint.parent.getWorldQuaternion(parentRotation).normalize();
    inverseParent.copy(parentRotation).invert();
    joint.quaternion.premultiply(parentRotation).premultiply(delta).premultiply(inverseParent).normalize();
    const state = states.get(joint);
    const change = state.animated.angleTo(joint.quaternion);
    if (change > state.limit) joint.quaternion.slerp(state.animated, 1 - state.limit / change);
    joint.updateWorldMatrix(false, true);
  }

  // Sample the armour along each link, not just the joint/end-effector centres.
  // The shoulder/hip socket itself must overlap its own adjacent body geometry.
  const samples = [
    [0, 1, 0.55, 0], [0, 1, 0.8, 0], [0, 1, 1, 0],
    [1, 2, 0.3, 1], [1, 2, 0.65, 1], [1, 2, 1, 1],
    [2, 3, 0.5, 1], [2, 3, 1, 1]
  ];

  function visit(correct) {
    let maximum = 0;
    for (const limb of limbs) {
      const others = limbs.filter(other => other !== limb);
      for (const [a, b, t, jointIndex] of samples) {
        const radius = (limb.arm ? (a === 0 ? 0.12 : a === 1 ? 0.105 : 0.075) : (a === 0 ? 0.15 : 0.11)) * unit;
        const obstacles = colliders.filter(collider => limb.arm || !['pelvis', 'torso'].includes(collider.kind));
        if (a === 2 || (a === 1 && t >= 0.65)) {
          // A deeply folded elbow/knee can put the lower limb through its own
          // upper armour. Keep the shared joint clear of this test.
          proximalEnd.copy(limb.points[0]).lerp(limb.points[1], 0.55);
          obstacles.push({ a: limb.points[0], b: proximalEnd, radius: (limb.arm ? 0.12 : 0.15) * unit });
        }
        for (const other of others) {
          // Arms avoid the legs; leg corrections do not chase moving arms.
          if (!limb.arm && other.arm) continue;
          obstacles.push(
            { a: other.points[0], b: other.points[1], radius: (other.arm ? 0.12 : 0.15) * unit },
            { a: other.points[1], b: other.points[2], radius: (other.arm ? 0.105 : 0.11) * unit }
          );
        }
        for (const obstacle of obstacles) {
          sample.copy(limb.points[a]).lerp(limb.points[b], t);
          const depth = penetration(sample, radius, obstacle, limb.side);
          maximum = Math.max(maximum, depth / unit);
          if (correct && depth > 0.001 * unit) {
            rotateOut(limb.bones[jointIndex], sample);
            updateLimb(limb);
          }
        }
      }
    }
    return maximum;
  }

  return {
    restore() {
      if (hasPose) controlled.forEach(({ bone: joint, animated }) => joint.quaternion.copy(animated));
    },
    solve() {
      controlled.forEach(({ bone: joint, animated }) => animated.copy(joint.quaternion));
      hasPose = true;
      refresh();
      // Fixed work budget, independent of frame rate; no simulation instability
      // or bone translation/scaling, and corrections never feed into the mixer.
      for (let i = 0; i < 8; i++) if (visit(true) < 0.002) break;
    },
    measure() { refresh(); return visit(false); }
  };
}
