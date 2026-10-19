# Footer robot motion sources

`robot-motions.json` contains animations adapted specifically to
`sci-fi-ob-robot.glb`. Original motion provider: **Adobe Mixamo**.
Download mirror: [Linzhan / Mixamo Animations and Characters on Hugging Face](https://huggingface.co/datasets/Linzhan/Mixamo-Animations-Characters).

Pinned dataset revision: `7f134bc734557b1d9516cb476d25ea1f577e45c1`.

| Site action | Source FBX | Mixamo motion ID | Duration |
| --- | --- | --- | --- |
| Wave | `animation/Waving.fbx` — Emotional Waving Forward | `c9c6cc85-b96c-11e4-a802-0aaa78deedf9` | 4.73 seconds |
| Backflip | `animation/Backflip_2.fbx` — Standing Backflip | `c9c9ea58-b96c-11e4-a802-0aaa78deedf9` | 2.17 seconds |

`animation/T-Pose.fbx` supplies the source skeleton's reference pose.
The generated JSON records each exact source URL and SHA-256 digest, plus the
target robot's SHA-256 digest.

The Mixamo motions remain subject to [Adobe's Mixamo terms](https://www.mixamo.com/#/faq);
see also [Adobe's Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html).
The Hugging Face dataset labels its license `adobe-mixamo-terms` and identifies
itself as a convenience mirror. These motions are included here as adapted
animation data for this website's robot, not as a standalone motion library.

## Conversion

`scripts/build-robot-motions.mjs` maps the Mixamo skeleton onto the robot's CC
skeleton, aligns anatomical segments to account for different reference poses,
converts world rotations into each target joint's local space, and scales hip
translation by leg length. It preserves jump height, removes horizontal drift,
and samples the motions at 30 fps. Constant tracks are optimized.

The website loads the resulting local JSON; visitors do not need an Adobe or
Hugging Face account, and no external animation API is called at runtime.

To rebuild with Node.js and Three.js 0.160.0:

```powershell
npm install --no-save --package-lock=false three@0.160.0
node scripts/build-robot-motions.mjs
node --test scripts/tests/footer-robot.test.mjs
```

Optionally pass a directory containing the three source FBXs to the build
command. Set `ROBOT_THREE_ROOT` to an existing directory with that version of
Three.js installed to reuse a separate tooling environment.

## Playback

- The robot waves once when it first becomes visible.
- Wave and Backflip buttons play a single action, then blend back to idle.
- Buttons wait for the current action and transition to finish.
- Cursor tracking continues during a wave and blends out during the backflip.
- Loading failure leaves the existing robot and cursor tracking usable.
- The existing scene policy and reduced-motion preference remain in effect.

## Self-collision avoidance

`assets/js/robot-self-collision.mjs` applies rotation-only constraints after
animation blending and cursor tracking. Bone-attached capsules approximate the
torso, head and limbs. Arms avoid the body, head, other arm and legs; legs avoid
each other and the upper body. Distal limb samples also avoid their own upper
arm/thigh armour when folded tightly. Shared shoulder, hip, elbow and knee
sockets are excluded from adjacent-link tests.

The solver preserves authored bone positions and scales, limits joint
corrections, and restores the uncorrected animation before the next mixer
update. Its bounds rotate with the robot during the flip and scale with the
scene. A small clearance margin starts avoidance before the armour touches.
These are conservative collision volumes, not per-triangle rigid-body physics
or a change to the model's skin weights.

The tests check all three motion clips at 60 fps for clearance, unchanged bone
lengths/scales, repeatability, and behaviour under rotated/scaled rigs and head
tracking.
