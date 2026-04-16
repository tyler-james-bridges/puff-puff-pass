# Three.js Animation Spec - Puff Puff Pass

Handoff doc for the 3D visual layer on [ppp.0x402.sh](https://ppp.0x402.sh).

## Current State

There is already a working three.js implementation in `public/index.html` (inline script). It renders a 3D joint with smoke particles. However it needs significant refinement:

- **Positioning is broken**: The canvas overlaps the leaderboard panel. Needs to be constrained to the hero/spotlight section only (left column).
- **Joint model is primitive**: Built from basic CylinderGeometry. Looks like a stick, not a joint.
- **Smoke is minimal**: Particle system exists but is subtle/barely visible.
- **three.js version**: Currently loading r152 UMD from jsdelivr CDN. The r170+ builds dropped UMD, so stay on r152 or find an alternative.

## Architecture

- **Single HTML file**: `public/index.html` contains all HTML, CSS, and JS inline. No build step, no framework.
- **CDN only**: three.js loaded from `https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.min.js`
- **Canvas placement**: Absolute-positioned `<canvas>` behind the hero content (z-index: 0). Text content sits on top (z-index: 1+).
- **Responsive**: Canvas resizes with the hero section dimensions.
- **Pass animation trigger**: `window.triggerPassAnimation()` is called when a new pass is confirmed. The existing form submission JS calls this on success.

## What Needs to Happen

### 1. Fix Canvas Containment

The three.js canvas must be confined to the left column (`.spotlight` section). Right now it bleeds into the leaderboard. The canvas should:
- Be a child of `.spotlight` (or absolutely positioned within it)
- Clip to the spotlight bounds
- Not interfere with the leaderboard panel on the right

### 2. Improve the Joint Model

Current model is basic cylinders. Target aesthetic: **cinematic, moody, like a joint sitting in an ashtray at 2 AM.**

The joint should have:
- Tapered paper body (wider at the lit end, narrower at the filter)
- Visible paper texture/wrinkles (can be done with normal map or displacement, or just subtle color variation)
- Rolled tip at the filter end
- Ash buildup near the ember (gray gradient)
- Glowing ember: not just orange, but with black char edges and a bright core
- Overall size: should feel like a real joint, not a log. Thin and delicate.

### 3. Smoke System Overhaul

The smoke is the star of the show. It should feel organic, lazy, atmospheric.

**Particle approach:**
- Sprite-based particles with a soft circular texture (generate via canvas or load a small PNG)
- 150-200 active particles
- Emit from the ember tip position
- Rise slowly with lateral drift (use Perlin/simplex noise for organic movement if possible, or layered sine waves)
- Start small and opaque near the tip, expand and fade as they rise
- Color: white/light gray near the base, pick up subtle green tint (#10b981) as they rise
- Additive blending for that soft, ethereal overlap effect
- Slight rotation per particle for variety

**Ambient smoke:**
- A few larger, very faint smoke sprites that drift across the entire hero area
- Creates a hazy, atmospheric backdrop
- Very slow movement, very low opacity

### 4. Ember Glow

- Point light at the ember tip, warm orange (#ff6b35 or similar)
- Pulsing intensity: layered sine waves at different frequencies for organic breathing
- When `triggerPassAnimation()` fires: flare to 3x intensity for ~0.5s, then decay back

### 5. Lighting

- Ambient light: very dim green (#10b981 at low intensity)
- Directional light from upper-left for rim lighting on the joint
- The ember point light provides the warm fill
- Overall scene should be dark and moody, not bright

### 6. Pass Animation (`triggerPassAnimation()`)

When someone passes the joint:
1. Ember flares bright (emissive + point light spike)
2. Burst of 30-50 extra smoke particles with higher initial velocity
3. Joint does a quick rotation (spin ~180 degrees) that decelerates
4. Optional: green particle sparks from the ember
5. Returns to normal idle state over ~2 seconds

### 7. Camera

- Static camera, slightly above and in front of the joint
- Joint should be positioned in the lower-right area of the spotlight section
- Camera framing: joint takes up maybe 30-40% of the canvas height
- The smoke rises into the upper portion, creating atmosphere behind the text

### 8. Performance

- Target 60fps on modern hardware, degrade gracefully
- No post-processing pipeline (no EffectComposer, bloom, etc.)
- Keep particle count under 250
- Use `requestAnimationFrame` with the standard render loop
- Dispose of textures/geometries if the component ever unmounts (not critical for a single-page app)
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` to cap retina rendering

## File Structure

Everything is inline in `public/index.html`. The three.js code lives in a `<script>` block after the ethers.js CDN tag and before the main app JS. Look for the comment block that starts the three.js section.

## Key DOM Elements

- `.spotlight` - the left column hero section (canvas parent)
- `.hero` - the two-column container
- `#holder-content` - current holder display
- `#pass-form` - the form (calls `triggerPassAnimation()` on success)

## Don't

- Don't add a build step or bundler
- Don't use three.js addons that require ES module imports (OrbitControls, etc.)
- Don't add React or any framework
- Don't put emojis anywhere in the code or UI
- Don't break the wallet connect or payment flow
- Don't use three.js newer than r152 (UMD build requirement)
- Don't make the scene too bright - this is a dark, moody aesthetic
