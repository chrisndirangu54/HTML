(() => {
  'use strict';

  const MODEL_URL = 'assets/models/sci-fi-ob-robot.glb';
  const MOTIONS_URL = 'assets/models/robot-motions.json';
  const COLLISION_URL = './robot-self-collision.mjs';
  const THREE_URL = 'https://esm.sh/three@0.160.0';
  const GLTF_LOADER_URL = 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
  const MESHOPT_URL = 'https://esm.sh/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js';
  const ROOM_ENV_URL = 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

  function mount() {
    const existing = document.getElementById('tt-footer-robot');
    if (existing) return existing;
    const contact = document.querySelector('#contact');
    const footer = document.querySelector('.footer-area');
    const section = document.createElement('section');
    section.id = 'tt-footer-robot';
    section.className = 'tt-footer-robot';
    section.setAttribute('aria-label', 'Animated sci-fi robot');
    section.innerHTML = `
      <div class="tt-footer-robot__copy">
        <h4 class="subtitle"><i class="las la-robot"></i> Always on</h4>
        <h2>Built to move with you.</h2>
      </div>
      <div class="tt-footer-robot__stage">
        <canvas id="tt-footer-robot-canvas" class="tt-footer-robot__canvas" aria-label="Animated sci-fi robot"></canvas>
        <div class="tt-footer-robot__loading">Loading robot…</div>
      </div>
      <div class="tt-footer-robot__actions" role="group" aria-label="Robot animations">
        <button type="button" class="tt-footer-robot__action" data-robot-action="wave" aria-pressed="false" disabled>
          <i class="las la-hand-paper" aria-hidden="true"></i> Wave
        </button>
        <button type="button" class="tt-footer-robot__action" data-robot-action="backflip" aria-pressed="false" disabled>
          <i class="las la-sync" aria-hidden="true"></i> Backflip
        </button>
      </div>
      <p class="tt-footer-robot__status" role="status" aria-live="polite">Loading moves…</p>`;
    if (footer && footer.parentNode) footer.parentNode.insertBefore(section, footer);
    else if (contact && contact.parentNode) contact.parentNode.insertBefore(section, contact.nextSibling);
    else document.body.appendChild(section);
    return section;
  }

  function posedBox(model, THREE) {
    const box = new THREE.Box3();
    let bones = 0;
    const point = new THREE.Vector3();
    model.updateMatrixWorld(true);
    model.traverse(obj => {
      if (obj.isSkinnedMesh && obj.skeleton) obj.skeleton.update();
      if (obj.isBone) {
        box.expandByPoint(obj.getWorldPosition(point));
        bones += 1;
      }
    });
    if (bones < 4) box.setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    box.expandByVector(size.multiplyScalar(0.22));
    return box;
  }

  async function start(root) {
    if (window.TTScenePolicy?.allowed !== true) return;
    const canvas = root.querySelector('#tt-footer-robot-canvas');
    const stage = root.querySelector('.tt-footer-robot__stage');
    const buttons = Array.from(root.querySelectorAll('[data-robot-action]'));
    const status = root.querySelector('.tt-footer-robot__status');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const [THREE, loaderModule, meshoptModule, collisionModule] = await Promise.all([
        import(THREE_URL),
        import(GLTF_LOADER_URL),
        import(MESHOPT_URL)
          .catch(() => import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_decoder.module.js'))
          .catch(() => import('https://unpkg.com/meshoptimizer@0.22.0/meshopt_decoder.module.js'))
          .catch(() => null),
        import(COLLISION_URL)
      ]);
      const { GLTFLoader } = loaderModule;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.debug.checkShaderErrors = false;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        console.warn('Footer robot WebGL context lost.');
      }, false);
      canvas.addEventListener('webglcontextrestored', () => {
        console.log('Footer robot WebGL context restored.');
        start(root);
      }, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
      scene.add(new THREE.HemisphereLight(0xe8ffff, 0x111018, 1.4));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(3, 5, 4);
      scene.add(key);
      const rim = new THREE.PointLight(0x14c5fd, 8, 12, 2);
      rim.position.set(-2, 1.4, 2);
      scene.add(rim);

      try {
        const { RoomEnvironment } = await import(ROOM_ENV_URL);
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envScene = new RoomEnvironment();
        scene.environment = pmrem.fromScene(envScene, 0.04).texture;
        pmrem.dispose();
      } catch (e) {
        console.warn('Robot environment map skipped:', e);
      }

      const resize = () => {
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
      };
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
      else window.addEventListener('resize', resize, { passive: true });
      resize();

      const loader = new GLTFLoader();
      const decoder = meshoptModule && (meshoptModule.MeshoptDecoder || meshoptModule.default);
      if (decoder) {
        if (decoder.ready) await decoder.ready;
        loader.setMeshoptDecoder(decoder);
      }
      const [gltf, motionData] = await Promise.all([
        new Promise((resolve, reject) => loader.load(MODEL_URL, resolve, undefined, reject)),
        fetch(MOTIONS_URL).then(response => {
          if (!response.ok) throw new Error(`Robot motions: HTTP ${response.status}`);
          return response.json();
        }).catch(error => {
          console.warn('Robot moves unavailable:', error);
          return null;
        })
      ]);
      const model = gltf.scene;
      model.traverse(child => {
        if (child.isMesh || child.isSkinnedMesh) {
          child.frustumCulled = false;
          child.castShadow = false;
          child.receiveShadow = false;
        }
        const materials = child.isMesh ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
        materials.forEach(material => {
          if (!material) return;
          if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
          material.needsUpdate = true;
        });
      });

      // These joints are already skinned to the neck and head in the GLB.
      const lookJoints = [
        { name: 'CC_Base_NeckTwist02_032', weight: 0.22 },
        { name: 'CC_Base_Head_033', weight: 0.78 }
      ].map(({ name, weight }) => {
        const bone = model.getObjectByName(name);
        if (!bone || !bone.isBone) return null;
        const rest = bone.quaternion.clone().normalize();
        return { bone, weight, rest, animated: rest.clone() };
      }).filter(Boolean);
      const head = model.getObjectByName('CC_Base_Head_033');
      const selfCollision = collisionModule.createSelfCollision(model, THREE);

      const mixer = new THREE.AnimationMixer(model);
      let idleAction = null;
      if (gltf.animations && gltf.animations.length) {
        const clip = gltf.animations[0].clone();
        // Keep the body animation, but let cursor tracking own these rotations.
        clip.tracks = clip.tracks.filter(track => !lookJoints.some(({ bone }) => track.name === `${bone.name}.quaternion`));
        idleAction = mixer.clipAction(clip).play();
        mixer.update(0.05);
      }

      const actions = new Map();
      if (motionData && motionData.version === 1 && Array.isArray(motionData.clips)) {
        for (const data of motionData.clips) {
          if (!['wave', 'backflip'].includes(data.name)) continue;
          try {
            const clip = THREE.AnimationClip.parse(data);
            if (!clip.validate()) throw new Error(`Invalid ${data.name} clip`);
            if (clip.name === 'wave') {
              clip.tracks = clip.tracks.filter(track => !lookJoints.some(({ bone }) => track.name === `${bone.name}.quaternion`));
            }
            const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            actions.set(clip.name, action);
          } catch (error) {
            console.warn('Robot move skipped:', error);
          }
        }
      }
      let activeAction = null;
      let activeName = '';
      let returnAt = null;
      let greetingDelay = !reduced && actions.has('wave') ? 0.8 : null;
      const readyMessage = reduced ? 'Animations paused for reduced motion.' : actions.size ? 'Move your cursor, or choose a move.' : 'Moves are unavailable. Refresh to try again.';
      const updateButtons = () => {
        buttons.forEach(button => {
          button.disabled = reduced || !!activeAction || !actions.has(button.dataset.robotAction);
          button.setAttribute('aria-pressed', String(button.dataset.robotAction === activeName));
        });
        root.classList.toggle('is-acting', !!activeAction);
      };
      const playMove = name => {
        const action = actions.get(name);
        if (!action || activeAction || reduced) return;
        greetingDelay = null;
        // Do not capture the procedural look pose as the mixer's original state.
        selfCollision.restore();
        lookJoints.forEach(({ bone, animated }) => bone.quaternion.copy(animated));
        activeAction = action;
        activeName = name;
        returnAt = null;
        action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.22).play();
        if (idleAction) idleAction.fadeOut(0.22);
        status.textContent = name === 'wave' ? 'Hello there!' : 'One backflip, coming up!';
        updateButtons();
      };
      buttons.forEach(button => button.addEventListener('click', () => playMove(button.dataset.robotAction)));
      mixer.addEventListener('finished', event => {
        if (event.action !== activeAction) return;
        if (idleAction) idleAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.3).play();
        activeAction.fadeOut(0.3);
        returnAt = mixer.time + 0.3;
      });

      const box = posedBox(model, THREE);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const height = Math.max(size.y, 0.01);
      const scale = 2.6 / height;
      const pivot = new THREE.Group();
      pivot.add(model);
      pivot.scale.setScalar(scale);
      pivot.position.copy(center).multiplyScalar(-scale);
      const restY = pivot.position.y;
      scene.add(pivot);

      resize();
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const dist = (2.6 * 0.7) / Math.tan(vFov / 2);
      camera.position.set(0, 0.05, dist);
      camera.near = dist / 50;
      camera.far = dist * 20;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      const pointer = new THREE.Vector2();
      const headPosition = new THREE.Vector3();
      const parentRotation = new THREE.Quaternion();
      const inverseParentRotation = new THREE.Quaternion();
      const cameraRotation = camera.quaternion.clone();
      const inverseCameraRotation = cameraRotation.clone().invert();
      const lookRotation = new THREE.Quaternion();
      const trackedRotation = new THREE.Quaternion();
      const lookAngles = new THREE.Euler(0, 0, 0, 'YXZ');
      let hasPointer = false;
      let lookX = 0;
      let lookY = 0;

      const onPointer = event => {
        if (event.pointerType === 'touch') return;
        pointer.set(event.clientX, event.clientY);
        hasPointer = true;
      };
      const resetPointer = () => { hasPointer = false; };
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('pointerout', event => {
        if (!event.relatedTarget) resetPointer();
      }, { passive: true });
      window.addEventListener('blur', resetPointer);

      const updateHead = dt => {
        // A flip owns the head until it blends back to cursor tracking.
        const trackingWeight = activeName === 'backflip' ? 1 - activeAction.getEffectiveWeight() : 1;
        lookJoints.forEach(({ bone, animated }) => animated.copy(bone.quaternion));
        let targetX = 0;
        let targetY = 0;
        if (hasPointer && head && !reduced && trackingWeight > 0) {
          // Measure from the head, not the canvas centre, including after scroll/resize.
          head.getWorldPosition(headPosition).project(camera);
          const rect = stage.getBoundingClientRect();
          if (rect.width && rect.height) {
            const headX = rect.left + (headPosition.x + 1) * rect.width * 0.5;
            const headY = rect.top + (1 - headPosition.y) * rect.height * 0.5;
            targetX = THREE.MathUtils.clamp((pointer.x - headX) / (rect.width * 0.5), -1, 1);
            targetY = THREE.MathUtils.clamp((pointer.y - headY) / (rect.height * 0.5), -1, 1);
          }
        }
        const smoothing = 1 - Math.exp(-9 * dt);
        lookX += (targetX - lookX) * smoothing;
        lookY += (targetY - lookY) * smoothing;
        lookJoints.forEach(({ bone, weight, rest, animated }) => {
          // Turn, nod and lightly tilt in screen axes, then convert to this rig's
          // parent space. Its imported bone axes do not match the camera axes.
          lookAngles.set(lookY * 0.48 * weight, lookX * 0.85 * weight, -lookX * 0.12 * weight);
          lookRotation.setFromEuler(lookAngles).premultiply(cameraRotation).multiply(inverseCameraRotation);
          bone.parent.getWorldQuaternion(parentRotation).normalize();
          inverseParentRotation.copy(parentRotation).invert();
          trackedRotation.copy(inverseParentRotation).multiply(lookRotation).multiply(parentRotation).multiply(rest).normalize();
          bone.quaternion.copy(animated).slerp(trackedRotation, trackingWeight).normalize();
          bone.updateWorldMatrix(false, true);
        });
      };

      const clock = new THREE.Clock();
      let visible = true;
      let inViewport = true;

      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(([entry]) => {
          inViewport = entry.isIntersecting;
        }, { rootMargin: '120px' });
        io.observe(root);
      }

      document.addEventListener('visibilitychange', () => {
        visible = !document.hidden;
        if (!visible) resetPointer();
      });
      renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), 0.05);
        if (!visible || !inViewport) return;
        const t = clock.elapsedTime;
        if (greetingDelay !== null) {
          greetingDelay -= dt;
          if (greetingDelay <= 0) playMove('wave');
        }
        selfCollision.restore();
        lookJoints.forEach(({ bone, animated }) => bone.quaternion.copy(animated));
        mixer.update(dt);
        if (returnAt !== null && mixer.time >= returnAt) {
          activeAction.stop();
          activeAction = null;
          activeName = '';
          returnAt = null;
          status.textContent = readyMessage;
          updateButtons();
        }
        const bodyMotion = activeAction ? 1 - activeAction.getEffectiveWeight() : 1;
        pivot.position.y = restY + (reduced ? 0 : Math.sin(t * 1.2) * 0.04 * bodyMotion);
        updateHead(dt);
        // Deadzone: ignore wave clearance at the fade-in/out tails so the arm
        // only lifts away from the chest once the action is well established,
        // and returns to rest before the action has fully faded out.
        // Remap [0.2, 1] → [0, 1] then square for a smooth ease-in/out.
        const _ew = activeAction?.getEffectiveWeight() || 0;
        const _waveWeight = Math.max(0, (_ew - 0.2) / 0.8) ** 2;
        selfCollision.solve({ wavingHand: activeName === 'wave' ? 'rightArm' : null, weight: _waveWeight });
        renderer.render(scene, camera);
      });
      root.classList.add('is-loaded');
      status.textContent = readyMessage;
      updateButtons();
    } catch (error) {
      console.error('Footer robot failed:', error);
      root.classList.add('has-error');
      status.textContent = 'The robot could not load. Refresh to try again.';
    }
  }

  function lazyStart() {
    if (window.TTScenePolicy?.allowed !== true) return;
    if (!document.body.classList.contains('home1-page')) return;
    const root = mount();
    if (!('IntersectionObserver' in window)) return start(root);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        start(root);
      }
    }, { rootMargin: '150px' });
    observer.observe(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lazyStart, { once: true });
  else lazyStart();
})();
