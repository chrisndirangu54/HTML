(() => {
  'use strict';

  const MODEL_URL = 'assets/models/sci-fi-ob-robot.glb';
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
      </div>`;
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
    const canvas = root.querySelector('#tt-footer-robot-canvas');
    const stage = root.querySelector('.tt-footer-robot__stage');
    try {
      const [THREE, loaderModule, meshoptModule] = await Promise.all([
        import(THREE_URL),
        import(GLTF_LOADER_URL),
        import(MESHOPT_URL).catch(() => import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_decoder.module.js').catch(() => null))
      ]);
      const { GLTFLoader } = loaderModule;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      if ('useLegacyLights' in renderer) renderer.useLegacyLights = true;

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
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      } catch {}

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
      const gltf = await new Promise((resolve, reject) => loader.load(MODEL_URL, resolve, undefined, reject));
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

      const mixer = gltf.animations && gltf.animations.length ? new THREE.AnimationMixer(model) : null;
      if (mixer) {
        mixer.clipAction(gltf.animations[0]).play();
        mixer.update(0.05);
      }

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

      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let targetX = 0;
      let targetY = 0;
      let lookX = 0;
      let lookY = 0;

      const onPointer = event => {
        const rect = stage.getBoundingClientRect();
        if (rect.width && rect.height) {
          targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          targetY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
        } else {
          targetX = (event.clientX / Math.max(innerWidth, 1)) * 2 - 1;
          targetY = (event.clientY / Math.max(innerHeight, 1)) * 2 - 1;
        }
        targetX = Math.max(-1, Math.min(1, targetX));
        targetY = Math.max(-1, Math.min(1, targetY));
      };
      window.addEventListener('pointermove', onPointer, { passive: true });
      stage.addEventListener('pointerleave', () => {
        targetX *= 0.35;
        targetY *= 0.35;
      });

      const clock = new THREE.Clock();
      let visible = true;
      document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
      renderer.setAnimationLoop(() => {
        if (!visible) return;
        const dt = clock.getDelta();
        const t = clock.elapsedTime;
        if (mixer) mixer.update(dt);
        lookX += (targetX - lookX) * 0.08;
        lookY += (targetY - lookY) * 0.08;
        if (reduced) {
          pivot.rotation.set(0, 0, 0);
          pivot.position.x = 0;
          pivot.position.y = restY;
        } else {
          pivot.rotation.set(-lookY * 0.32, lookX * 0.85, lookX * -0.08);
          pivot.position.x = lookX * 0.18;
          pivot.position.y = restY + Math.sin(t * 1.2) * 0.04 - lookY * 0.12;
        }
        renderer.render(scene, camera);
      });
      root.classList.add('is-loaded');
    } catch (error) {
      console.error('Footer robot failed:', error);
      root.classList.add('has-error');
    }
  }

  function lazyStart() {
    if (!document.body.classList.contains('home1-page')) return;
    const root = mount();
    if (!('IntersectionObserver' in window)) return start(root);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        start(root);
      }
    }, { rootMargin: '280px' });
    observer.observe(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lazyStart, { once: true });
  else lazyStart();
})();
