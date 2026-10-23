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
  // Extra scratch vectors for the extended collider pairs.
  const neckTop = new THREE.Vector3();
  let unit = 1;
  let hasPose = false;
  let wavingHand = null;
  let clearanceWeight = 0;
  const colliders = [];
  // Pick the outermost skinned hand vertices in multiple directions. Joint
  // centres alone miss the fingers and thick armour around the palm.
  const handSurfaces = new Map();
  model.updateWorldMatrix(true, true);
  for (const limb of limbs.filter(limb => limb.arm)) {
    const hand = limb.bones[2];
    const descendants = new Set();
    hand.traverse(joint => descendants.add(joint));
    const candidates = [];
    model.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return;
      mesh.skeleton.update();
      const indices = mesh.geometry.getAttribute('skinIndex');
      const weights = mesh.geometry.getAttribute('skinWeight');
      if (!indices || !weights) return;
      for (let i = 0; i < indices.count; i++) {
        let handWeight = 0;
        for (let j = 0; j < 4; j++) {
          if (descendants.has(mesh.skeleton.bones[indices.getComponent(i, j)])) handWeight += weights.getComponent(i, j);
        }
        if (handWeight < 0.5) continue;
        const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        hand.worldToLocal(point);
        candidates.push({ mesh, index: i, point });
      }
    });
    const selected = new Set();
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
      if (!x && !y && !z) continue;
      let best = null, distance = -Infinity;
      for (const vertex of candidates) {
        const score = vertex.point.x * x + vertex.point.y * y + vertex.point.z * z;
        if (score > distance) { best = vertex; distance = score; }
      }
      if (best) selected.add(best);
    }
    handSurfaces.set(limb.name, [...selected]);
  }

  function refresh() {
    model.updateWorldMatrix(true, true);
    unit = Math.max(Math.abs(model.getWorldScale(scale).x), 1e-8);
    [hip, waist, chest, neck].forEach((joint, i) => joint.getWorldPosition(positions[i]));
    positions[4].copy(headOffset); head.localToWorld(positions[4]);
    // Shoulder separation supplies a stable outward direction even upside down.
    sideways.copy(leftShoulder.getWorldPosition(from)).sub(rightShoulder.getWorldPosition(to)).normalize();
    // Build the neck-top point: halfway between neck base and head centre.
    neckTop.copy(positions[3]).lerp(positions[4], 0.5);
    colliders.length = 0;
    colliders.push(
      { a: positions[0], b: positions[1], radius: 0.21 * unit, kind: 'pelvis' },
      { a: positions[1], b: positions[2], radius: 0.23 * unit, kind: 'torso' },
      { a: positions[2], b: positions[3], radius: 0.26 * unit, kind: 'chest' },
      // Neck collider — prevents extreme head-look from driving chin into chest.
      { a: positions[3], b: neckTop,      radius: 0.12 * unit, kind: 'neck'  },
      { a: positions[4], b: positions[4], radius: 0.18 * unit, kind: 'head'  }
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
  // The shoulder/hip socket itself must overlap its own adjacent body geometry,
  // so the upper segment starts at t=0.55 — testing any earlier would push arms
  // and legs out at rest because the proximal socket lives inside the body capsule.
  const samples = [
    [0, 1, 0.55, 0], [0, 1, 0.8, 0], [0, 1, 1, 0],
    [1, 2, 0.3, 1], [1, 2, 0.65, 1], [1, 2, 1, 1],
    [2, 3, 0, 1], [2, 3, 0.25, 1], [2, 3, 0.5, 1], [2, 3, 0.75, 1], [2, 3, 1, 1]
  ];

  function visit(correct) {
    let maximum = 0;
    for (const limb of limbs) {
      const others = limbs.filter(other => other !== limb);
      const handClearance = limb.name === wavingHand ? clearanceWeight : 0;
      for (const [a, b, t, jointIndex] of samples) {
        // Cover the palm/knuckle armour, not just the thin wrist-to-index line.
        const radius = (limb.arm ? (a === 0 ? 0.12 : a === 1 ? 0.105 : 0.075 + 0.055 * handClearance) : (a === 0 ? 0.15 : 0.11)) * unit;
        const obstacles = colliders.filter(collider => {
          // Legs only avoid chest/head/neck (not pelvis/torso which their sockets live in).
          // Arms avoid all body colliders.
          if (limb.arm) return true;
          return !['pelvis', 'torso'].includes(collider.kind);
        }).map(collider => {
          // During waving, expand chest and torso clearance across ALL arm
          // segments (upper arm, forearm, and hand), not just the hand/finger
          // region. The upper arm and forearm sweep directly across the chest
          // face during a wave and need the same enlarged envelope.
          // Scale of padding by segment: upper arm needs the most push-out
          // (it arcs closest to the pec armour), forearm slightly less, hand
          // already had the original treatment.
          let padding = 0;
          if (handClearance && limb.arm) {
            if (a === 0) {
              // Upper arm arcs across chest/shoulder socket — largest padding.
              padding = collider.kind === 'chest' ? 0.11 : collider.kind === 'torso' ? 0.07 : 0;
            } else if (a === 1) {
              // Forearm sweeps in front of the chest plate.
              padding = collider.kind === 'chest' ? 0.09 : collider.kind === 'torso' ? 0.08 : 0;
            } else {
              // Hand / finger region — original values.
              padding = collider.kind === 'torso' ? 0.09 : collider.kind === 'chest' ? 0.08 : 0;
            }
          }
          return padding ? { ...collider, radius: collider.radius + padding * handClearance * unit } : collider;
        });
        if (a === 2 || (a === 1 && t >= 0.65)) {
          // A deeply folded elbow/knee can put the lower limb through its own
          // upper armour. Keep the shared joint clear of this test.
          proximalEnd.copy(limb.points[0]).lerp(limb.points[1], 0.55);
          obstacles.push({ a: limb.points[0], b: proximalEnd, radius: (limb.arm ? 0.12 : 0.15) * unit });
        }
        for (const other of others) {
          // Arms avoid legs; leg corrections do not chase moving arms.
          if (!limb.arm && other.arm) continue;

          // ── Upper segment of the other limb ──────────────────────────────────
          obstacles.push(
            { a: other.points[0], b: other.points[1], radius: (other.arm ? 0.12 : 0.15) * unit }
          );

          // ── Lower / mid segment of the other limb ───────────────────────────
          obstacles.push(
            { a: other.points[1], b: other.points[2], radius: (other.arm ? 0.105 : 0.11) * unit }
          );

          // ── Distal segment (hand / foot region) of the other limb ────────────
          // Prevents a hand from poking through an opposing forearm or foot,
          // and a foot from overlapping the opposite shin during crouches/flips.
          if (other.points[2] && other.points[3]) {
            obstacles.push(
              { a: other.points[2], b: other.points[3], radius: (other.arm ? 0.075 : 0.09) * unit }
            );
          }
        }

        // ── Cross-type avoidance: arm lower segments vs leg upper segments ─────
        // Handles arms swinging toward thighs during idle sway and backflip.
        if (limb.arm && (a === 1 || a === 2)) {
          const legs = limbs.filter(l => !l.arm);
          for (const leg of legs) {
            obstacles.push(
              { a: leg.points[0], b: leg.points[1], radius: 0.15 * unit },
              { a: leg.points[1], b: leg.points[2], radius: 0.11 * unit }
            );
          }
        }

        for (const obstacle of obstacles) {
          sample.copy(limb.points[a]).lerp(limb.points[b], t);
          const depth = penetration(sample, radius, obstacle, limb.side);
          maximum = Math.max(maximum, depth / unit);
          if (correct && depth > 0.001 * unit) {
            rotateOut(limb.bones[jointIndex], sample);
            updateLimb(limb);
            // A folded elbow can exhaust its safe swing. Move the shoulder too
            // rather than forcing the palm through the enlarged armour bounds.
            if (jointIndex === 1 && handClearance > 0) {
              sample.copy(limb.points[a]).lerp(limb.points[b], t);
              if (penetration(sample, radius, obstacle, limb.side) > 0.001 * unit) {
                rotateOut(limb.bones[0], sample);
                updateLimb(limb);
              }
            }
          }
        }
      }
      // ── Dense arm-vs-chest sweep for the waving arm ──────────────────────────
      // The general sample loop above already applies expanded chest/torso radii,
      // but it only runs the fixed sample points. During a wave the upper arm
      // and forearm arc continuously across the chest face, so we add a targeted
      // pass with finer interval sampling along both segments against just the
      // chest and torso body colliders.
      if (handClearance > 0 && limb.arm) {
        const wavingBodyObstacles = colliders.filter(c => ['chest', 'torso'].includes(c.kind)).map(c => ({
          ...c,
          radius: c.radius + (c.kind === 'chest' ? 0.11 : 0.09) * handClearance * unit
        }));
        // 7 evenly-spaced points across upper arm then forearm.
        const waveSamples = [
          [0, 1, 1 / 6, 0], [0, 1, 2 / 6, 0], [0, 1, 3 / 6, 0], [0, 1, 4 / 6, 0], [0, 1, 5 / 6, 0],
          [1, 2, 1 / 6, 1], [1, 2, 2 / 6, 1], [1, 2, 3 / 6, 1], [1, 2, 4 / 6, 1], [1, 2, 5 / 6, 1]
        ];
        for (const [a, b, t, jointIndex] of waveSamples) {
          const r = (a === 0 ? 0.12 : 0.105) * unit;
          sample.copy(limb.points[a]).lerp(limb.points[b], t);
          for (const obstacle of wavingBodyObstacles) {
            const depth = penetration(sample, r, obstacle, limb.side);
            maximum = Math.max(maximum, depth / unit);
            if (correct && depth > 0.001 * unit) {
              rotateOut(limb.bones[jointIndex], sample);
              updateLimb(limb);
            }
          }
        }
      }

      if (handClearance > 0) {
        for (const vertex of handSurfaces.get(limb.name) || []) {
          for (const body of colliders) {
            // Mesh measurements put the front chest armour beyond the small
            // joint capsule. Apply this envelope only to the waving hand.
            const padding = ['torso', 'chest'].includes(body.kind) ? 0.11 * unit * handClearance : 0;
            const collider = padding ? { ...body, radius: body.radius + padding } : body;
            vertex.mesh.skeleton.update();
            vertex.mesh.getVertexPosition(vertex.index, sample).applyMatrix4(vertex.mesh.matrixWorld);
            const depth = penetration(sample, 0.015 * unit * handClearance, collider, limb.side);
            maximum = Math.max(maximum, depth / unit);
            if (correct && depth > 0.001 * unit) {
              rotateOut(limb.bones[1], sample);
              vertex.mesh.skeleton.update();
              vertex.mesh.getVertexPosition(vertex.index, sample).applyMatrix4(vertex.mesh.matrixWorld);
              if (penetration(sample, 0.015 * unit * handClearance, collider, limb.side) > 0.001 * unit) rotateOut(limb.bones[0], sample);
              updateLimb(limb);
            }
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
    solve({ wavingHand: hand = null, weight = 1 } = {}) {
      wavingHand = hand;
      clearanceWeight = THREE.MathUtils.clamp(weight, 0, 1);
      controlled.forEach(({ bone: joint, animated }) => animated.copy(joint.quaternion));
      hasPose = true;
      refresh();
      // Fixed work budget, independent of frame rate; no simulation instability
      // or bone translation/scaling, and corrections never feed into the mixer.
      for (let i = 0; i < 16; i++) if (visit(true) < 0.002) break;
    },
    measure() { refresh(); return visit(false); }
  };
}
