# Three.js Vision - Puff Puff Pass

## The Original Vision

A **cinematic, moody burning joint** as the hero visual element of the site. Not a small icon or accent piece. The joint IS the experience.

Think: a joint sitting slightly tilted, glowing ember at the tip, with realistic smoke curling lazily upward. Smoke drifts across the background behind the current holder's name. The whole vibe is 2 AM, dark room, smoke catching the light. 4/20 energy.

## What We Were Building

### The Joint (3D model, center stage)
- Built from three.js primitives (CylinderGeometry)
- Tapered paper body: wider at the lit end, narrower at the filter
- Filter end: brownish/tan color
- Ember tip: glowing orange/red with black char edges and bright core
- Ash buildup near the ember (gray gradient)
- Tilted ~15-20 degrees
- Slow, subtle Y-axis rotation
- Positioned prominently in the hero/spotlight area, not as a tiny accent

### Smoke (the star of the show)
- Particle system: 150-200 active sprites
- Emit from the ember tip
- Rise slowly with organic lateral drift (layered sine waves or noise)
- Start small and opaque, expand and fade as they rise
- Color gradient: white/light gray near base, picks up green tint (#10b981) as it rises
- Additive blending for soft, ethereal overlapping
- Slight per-particle rotation for variety
- Ambient smoke: a few large, very faint sprites drifting across the entire hero area for haze

### Ember Glow
- Point light at the ember tip, warm orange
- Pulsing intensity: layered sine waves for organic breathing effect
- On pass event: flares to 3x intensity

### Lighting
- Ambient: very dim green (#10b981)
- Directional rim light from upper-left
- Ember point light provides warm fill
- Overall: dark, moody, cinematic. Not bright.

### Pass Animation (triggerPassAnimation)
When someone passes the joint:
1. Ember flares bright (emissive + point light spike)
2. Burst of 30-50 extra smoke particles with higher velocity
3. Joint does a quick spin (~180 degrees) that decelerates
4. Optional: green particle sparks from ember
5. Returns to idle over ~2 seconds

## What Actually Happened

### Phase 1 (our session)
- Got the basic joint rendering with CylinderGeometry
- Smoke particle system working but subtle
- Ember glow with pulsing
- Canvas positioned behind hero content
- triggerPassAnimation() wired up
- Problem: canvas was bleeding into the leaderboard area
- Problem: three.js r170 dropped UMD builds, had to fall back to r152

### Phase 2 (handoff to another harness, PRs #1-#4)
The other harness iterated through 4 PRs:
1. Added the full scene with smoke + pass animation
2. Made spotlight panels translucent so the scene shows through
3. Made the joint bolder, visible ember halo, brighter smoke, mobile tuning
4. **Shrunk the scene down to emoji-sized accent next to the title**

That last PR (#4) diverged from the vision. The joint went from being the hero centerpiece to a tiny icon. The original intent was for it to be atmospheric and immersive, not decorative.

## Where to Go From Here

The goal is to get back to the original vision:
- Joint as a prominent visual element (not emoji-sized)
- Smoke filling the hero area atmosphere
- Canvas properly contained to the spotlight section (the fix for the bleed issue)
- Moody, cinematic, 4/20 vibe

## Technical Constraints
- Single HTML file: `public/index.html`, all inline, no build step
- three.js r152 from CDN (UMD): `https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.min.js`
- No three.js addons requiring ES module imports
- No React/framework
- Canvas behind content (z-index layering), pointer-events: none
- Responsive: resize with window
- Performance: under 250 particles, no post-processing, 60fps target
- Zero emojis in code or UI
- Dark background (#0a0a0a), green accent (#10b981)
