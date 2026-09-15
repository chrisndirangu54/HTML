# Gaming PC hero

The homepage `#home` section mounts a procedural Three.js gaming PC through `assets/js/hero-gaming-pc.js`.

- No GLB/GLTF asset is required, avoiding the incomplete model upload that caused the object to be invisible.
- `assets/js/color.js` loads the hero renderer only on pages that contain `#home`.
- The object rotates with hero scroll progress and responds subtly to pointer movement.
- RGB fan lighting pulses while fan blades spin.
- `assets/css/hero-gaming-pc.css` provides explicit positioning/z-index and a visible CSS fallback if WebGL or the Three.js CDN is unavailable.
- Mobile uses a relative layout beneath the hero copy so the object cannot be clipped off-screen.
- `prefers-reduced-motion` disables unnecessary motion while preserving the object.
