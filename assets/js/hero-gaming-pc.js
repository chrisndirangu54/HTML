(() => {
  'use strict';

  const HOME = '#home';
  const CSS_URL = 'assets/css/hero-gaming-pc.css';
  const MODEL_URL = 'assets/models/gaming-setup.glb';
  const MODEL_CHUNKS = Array.from({ length: 6 }, (_, index) => `assets/models/gaming-pc-user.${index}.b64`);
  const THREE_URL = 'https://esm.sh/three@0.160.0';
  const GLTF_LOADER_URL = 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
  const ROOM_ENV_URL = 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

  function addCss() {
    if ([...document.styleSheets].some(s => s.href && s.href.includes('hero-gaming-pc.css'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  async function loadModelBytes() {
    const parts = await Promise.all(MODEL_CHUNKS.map(async path => {
      const response = await fetch(path, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Model chunk failed: ${path}`);
      return response.text();
    }));
    const raw = atob(parts.join('').replace(/\s+/g, ''));
    let bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
    const view = new DataView(bytes.buffer);
    if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'glTF' || view.getUint32(4, true) !== 2) {
      throw new Error('Invalid model GLB signature or version');
    }
    const declaredLength = view.getUint32(8, true);
    const missing = declaredLength - bytes.byteLength;
    if (missing < 0 || missing > 4096) throw new Error('Unsafe model GLB length mismatch');
    if (missing) {
      const repaired = new Uint8Array(declaredLength);
      repaired.set(bytes);
      bytes = repaired;
    }
    const repairedView = new DataView(bytes.buffer);
    const jsonLength = repairedView.getUint32(12, true);
    const binHeader = 20 + jsonLength;
    if (String.fromCharCode(...bytes.subarray(16, 20)) !== 'JSON' || binHeader + 8 > bytes.byteLength) {
      throw new Error('Invalid model GLB JSON chunk');
    }
    const binLength = repairedView.getUint32(binHeader, true);
    const binTag = bytes.subarray(binHeader + 4, binHeader + 8);
    if (binTag[0] !== 66 || binTag[1] !== 73 || binTag[2] !== 78 || binTag[3] !== 0 || binHeader + 8 + binLength !== bytes.byteLength) {
      throw new Error('Invalid model GLB binary chunk');
    }
    return bytes.buffer;
  }

  function mountShell(home) {
    const existing = document.getElementById('tt-gaming-pc');
    if (existing) return existing;

    const root = document.createElement('div');
    root.id = 'tt-gaming-pc';
    root.className = 'tt-gaming-pc';
    root.setAttribute('aria-label', 'Interactive 3D gaming setup');
    root.innerHTML = `
      <div class="tt-gaming-pc__sticky">
        <div class="tt-gaming-pc__stage">
          <div class="tt-gaming-pc__glow" aria-hidden="true"></div>
          <canvas id="tt-gaming-pc-canvas" class="tt-gaming-pc__canvas" aria-label="TeknTandao gaming setup 3D model"></canvas>
          <div class="tt-gaming-pc__loading">Loading 3D setup… <span data-pc-progress>0%</span></div>
          <div class="tt-gaming-pc__badge">Scroll to rotate <span data-pc-spin>0%</span></div>
          <div class="tt-gaming-pc__error">3D model could not load</div>
        </div>
      </div>`;

    const container = home.querySelector('.custom-container');
    if (container) container.insertAdjacentElement('afterend', root);
    else home.appendChild(root);
    return root;
  }

  function createScene(root, canvas, THREE) {
    const stage = root.querySelector('.tt-gaming-pc__stage');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.debug.checkShaderErrors = false;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1 : 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      console.warn('Hero 3D setup context lost.');
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      console.log('Hero 3D setup context restored.');
      start3d(root);
    }, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
    camera.position.set(0, 0.45, 6.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.HemisphereLight(0xd7f4ff, 0x1a120c, 1.35));
    const key = new THREE.DirectionalLight(0xfff6ea, 2.1);
    key.position.set(3.2, 5.4, 4.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xb9dcff, 0.8);
    fill.position.set(-4.5, 2.2, 2.4);
    scene.add(fill);
    const cyan = new THREE.PointLight(0x19dfff, 10, 18, 2);
    cyan.position.set(1.2, 0.8, 2.4);
    scene.add(cyan);
    const purple = new THREE.PointLight(0x8d38ff, 8, 16, 2);
    purple.position.set(-1.6, 0.4, 1.8);
    scene.add(purple);

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

    return { renderer, scene, camera, cyan, purple, stage };
  }

  async function addEnvironment(renderer, scene, THREE) {
    try {
      const { RoomEnvironment } = await import(ROOM_ENV_URL);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();
    } catch (error) {
      console.warn('Gaming setup environment map skipped:', error);
    }
  }

  function prepareMaterials(model, THREE) {
    model.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = 4;
        }
        if (material.emissiveMap) {
          material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          if (material.emissiveIntensity < 0.35) material.emissiveIntensity = 1.15;
        }
        material.needsUpdate = true;
      }
    });
  }

  function mountCentered(model, scene, THREE) {
    const pivot = new THREE.Group();
    scene.add(pivot);
    pivot.add(model);
    model.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    const maxAxis = Math.max(size.x, size.y, size.z, 1);
    pivot.scale.setScalar(3.2 / maxAxis);

    model.updateWorldMatrix(true, true);
    const recentered = box.setFromObject(model).getCenter(new THREE.Vector3());
    model.position.sub(pivot.worldToLocal(recentered));
    return pivot;
  }

  const REEL_SRC = 'assets/images/tekntandao-gaming-reel.mp4';
  const REEL_CREDIT = '#';

  function pinProgress(root) {
    const rect = root.getBoundingClientRect();
    if (innerWidth <= 900) {
      const sticky = root.querySelector('.tt-gaming-pc__sticky');
      const pinTop = (innerHeight - sticky.offsetHeight) / 2;
      // Scroll the outer track while the setup stays pinned at the center.
      return Math.max(0, Math.min(1, (pinTop - rect.top) / Math.max(innerHeight * 0.4, 1)));
    }
    const total = Math.max(root.offsetHeight - innerHeight, 1);
    return Math.max(0, Math.min(1, -rect.top / total));
  }

  function revealReel(root, sceneState) {
    const stage = root.querySelector('.tt-gaming-pc__stage');
    const badge = root.querySelector('.tt-gaming-pc__badge');
    if (badge) badge.textContent = 'Gaming reel';

    if (stage && !stage.querySelector('.tt-gaming-pc__video')) {
      const video = document.createElement('video');
      video.className = 'tt-gaming-pc__video';
      video.muted = true;
      video.defaultMuted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.volume = 0.18;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = 'auto';
      video.addEventListener('loadeddata', () => {
        root.classList.add('is-reel-ready');
      }, { once: true });
      video.src = REEL_SRC;
      video.setAttribute('aria-label', 'TeknTandao gaming setup reel');

      const muteButton = document.createElement('button');
      muteButton.type = 'button';
      muteButton.className = 'tt-gaming-pc__mute';
      muteButton.setAttribute('aria-label', video.muted ? 'Unmute reel' : 'Mute reel');
      muteButton.title = video.muted ? 'Unmute reel' : 'Mute reel';
      muteButton.textContent = video.muted ? '🔇' : '🔊';
      muteButton.addEventListener('click', () => {
        video.muted = !video.muted;
        muteButton.textContent = video.muted ? '🔇' : '🔊';
        muteButton.title = video.muted ? 'Unmute reel' : 'Mute reel';
        muteButton.setAttribute('aria-label', video.muted ? 'Unmute reel' : 'Mute reel');
      });

      const credit = document.createElement('a');
      credit.className = 'tt-gaming-pc__credit';
      credit.href = REEL_CREDIT;
      credit.target = '_blank';
      credit.rel = 'noopener noreferrer';
      credit.textContent = 'TeknTandao';
      stage.appendChild(video);
      stage.appendChild(muteButton);
      stage.appendChild(credit);

      const isStageVisible = () => {
        const rect = stage.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      };
      const updatePlayback = isVisible => {
        if (isVisible && root.classList.contains('is-revealed')) video.play().catch(() => {});
        else video.pause();
      };
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          updatePlayback(entries.some(entry => entry.isIntersecting) && isStageVisible());
        }, { threshold: 0.01 });
        observer.observe(stage);
        updatePlayback(isStageVisible());
      } else {
        updatePlayback(isStageVisible());
      }
    } else if (stage) {
      const video = stage.querySelector('.tt-gaming-pc__video');
      const muteButton = stage.querySelector('.tt-gaming-pc__mute');
      if (video) {
        video.volume = 0.18;
        const rect = stage.getBoundingClientRect();
        const isVisible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        if (isVisible) video.play().catch(() => {});
        else video.pause();
      }
      if (muteButton) {
        muteButton.textContent = video && video.muted ? '🔇' : '🔊';
        muteButton.title = video && video.muted ? 'Unmute reel' : 'Mute reel';
        muteButton.setAttribute('aria-label', video && video.muted ? 'Unmute reel' : 'Mute reel');
      }
    }
  }

  function wireMotion(root, pivot, mixer, sceneState, THREE) {
    const canvas = root.querySelector('#tt-gaming-pc-canvas');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const badge = root.querySelector('.tt-gaming-pc__badge');
    const YAW_START = Math.PI / 2;
    const rotationEnd = 0.7;
    let progress = pinProgress(root);
    // Prepare the reel while the model rotates, retaining the model until a frame is ready.
    revealReel(root, sceneState);
    const reel = root.querySelector('.tt-gaming-pc__video');
    if (reel) reel.pause();
    let mouseX = 0;
    let smoothX = 0;
    let dragX = 0;
    let dragY = 0;
    let isDragging = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let visible = true;
    let inViewport = true;

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting;
      }, { rootMargin: '120px' });
      io.observe(root);
    }

    if (canvas) {
      canvas.style.cursor = 'grab';
      canvas.addEventListener('pointerdown', e => {
        isDragging = true;
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
      });
      canvas.addEventListener('pointermove', e => {
        if (!isDragging) return;
        const dx = e.clientX - startPointerX;
        const dy = e.clientY - startPointerY;
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        dragX += dx * 0.009;
        dragY = Math.max(-0.6, Math.min(0.6, dragY + dy * 0.009));
      });
      const stopDrag = e => {
        if (isDragging) {
          isDragging = false;
          if (canvas.releasePointerCapture) canvas.releasePointerCapture(e.pointerId);
          canvas.style.cursor = 'grab';
        }
      };
      canvas.addEventListener('pointerup', stopDrag);
      canvas.addEventListener('pointercancel', stopDrag);
    }

    window.addEventListener('pointermove', event => {
      mouseX = (event.clientX / Math.max(innerWidth, 1)) * 2 - 1;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

    const clock = new THREE.Clock();
    sceneState.renderer.setAnimationLoop(() => {
      if (!visible || !inViewport) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      if (mixer && !reduced) mixer.update(dt);
      if (!reduced) smoothX += (mouseX - smoothX) * 0.08;
      const target = pinProgress(root);
      progress += (target - progress) * (1 - Math.exp(-dt * 10));
      const spin = reduced ? target : progress;
      const turn = Math.min(spin / rotationEnd, 1);
      const morphTarget = root.classList.contains('is-reel-ready') && spin >= rotationEnd;
      if (root.classList.contains('is-revealed') !== morphTarget) {
        root.classList.toggle('is-revealed', morphTarget);
        if (reel) {
          if (morphTarget) reel.play().catch(() => {});
          else reel.pause();
        }
      }

      const pinning = spin > 0 && spin < 1;
      root.classList.toggle('is-pinning', pinning);

      const rotY = reduced ? YAW_START : YAW_START + turn * Math.PI + (dragX + smoothX * 0.12) * (1 - turn);
      const rotX = reduced ? 0 : dragY;
      pivot.rotation.set(rotX, rotY, 0);
      pivot.position.y = reduced || innerWidth <= 900 ? 0 : Math.sin(t * 1.1) * 0.03;

      if (badge) {
        badge.textContent = morphTarget ? 'Gaming reel' : isDragging ? 'Dragging 3D setup' : `Scroll to rotate · ${Math.round(turn * 180)}°`;
      }

      sceneState.cyan.intensity = 8.5 + Math.sin(t * 2.1) * 1.8;
      sceneState.purple.intensity = 6.5 + Math.cos(t * 1.7) * 1.4;
      sceneState.renderer.render(sceneState.scene, sceneState.camera);
    });
  }

  function setProgress(root, value) {
    const label = root.querySelector('[data-pc-progress]');
    if (label) label.textContent = `${Math.round(value * 100)}%`;
  }

  async function start3d(root) {
    const canvas = root.querySelector('#tt-gaming-pc-canvas');
    try {
      const [THREE, loaderModule] = await Promise.all([
        import(THREE_URL),
        import(GLTF_LOADER_URL)
      ]);
      const { GLTFLoader } = loaderModule;
      const sceneState = createScene(root, canvas, THREE);
      await addEnvironment(sceneState.renderer, sceneState.scene, THREE);
      const loader = new GLTFLoader();
      const loadPrimary = () => new Promise((resolve, reject) => {
        loader.load(
          MODEL_URL,
          resolve,
          event => {
            if (event.total && event.total > 0) {
              setProgress(root, event.loaded / event.total);
            } else if (event.loaded) {
              const mb = (event.loaded / (1024 * 1024)).toFixed(1);
              const label = root.querySelector('[data-pc-progress]');
              if (label) label.textContent = `${mb} MB`;
            }
          },
          reject
        );
      });
      let gltf;
      try {
        gltf = await loadPrimary();
      } catch (primaryError) {
        console.warn('Primary gaming setup model failed; trying the local user model.', primaryError);
        const buffer = await loadModelBytes();
        gltf = await new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject));
      }
      const model = gltf.scene;
      prepareMaterials(model, THREE);
      const pivot = mountCentered(model, sceneState.scene, THREE);
      const mixer = gltf.animations && gltf.animations.length ? new THREE.AnimationMixer(model) : null;
      if (mixer) mixer.clipAction(gltf.animations[0]).play();
      root.classList.add('is-loaded');
      wireMotion(root, pivot, mixer, sceneState, THREE);
    } catch (error) {
      console.error('Gaming setup GLB load failed:', error);
      root.classList.add('has-error');
      const errEl = root.querySelector('.tt-gaming-pc__error');
      if (errEl) errEl.textContent = '3D model temporarily unavailable';
    }
  }

  async function start() {
    if (window.TTScenePolicy?.allowed !== true) return;
    const home = document.querySelector(HOME);
    if (!home) return;
    addCss();
    const root = mountShell(home);
    if (!root) return;
    await start3d(root);
  }

  function lazyStart() {
    if (window.TTScenePolicy?.allowed !== true) return;
    const home = document.querySelector(HOME);
    if (!home) return;
    if (!('IntersectionObserver' in window)) return start();
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    }, { rootMargin: '150px' });
    observer.observe(home);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lazyStart, { once: true });
  else lazyStart();
})();
