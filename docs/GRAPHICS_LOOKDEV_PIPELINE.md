# Brick City Defense — Graphics Lookdev Pipeline

Status: active graphics SSOT
Last verified: 2026-08-20
Runtime: Three.js r150 classic script, WebGL, `file://` + GitHub Pages
Offline lookdev reference: Unreal Engine 5.8.0 (installed at `C:\Program Files\Epic Games\UE_5.8`)

## 1. Product decision

The target is not generic realism. It is a readable toy-city action game with the material response, edge highlights, miniature scale cues and deliberate color hierarchy expected from premium ABS-brick photography.

The shipped runtime remains WebGL. Unreal Engine is an authoring and reference renderer, not the public runtime:

- Epic documents Pixel Streaming as a packaged Unreal application running on a desktop or cloud server and sending frames through WebRTC. It needs a signalling/web server and a compatible hardware encoder. That does not fit static GitHub Pages, zero server cost, offline `file://`, or independent friend sessions.
- The current WebGL build remains independently rendered on each player's PC, starts from a static URL and keeps the no-network-at-runtime contract.
- UE5.8 is reserved for calibrated material turntables, lighting comparisons, offline beauty renders and optional texture/normal/AO baking. Any UE result must still be translated into the WebGL budgets below before release.

Primary evidence:

- Epic Pixel Streaming overview: https://dev.epicgames.com/documentation/unreal-engine/pixel-streaming-in-unreal-engine
- Epic infrastructure requirements: https://dev.epicgames.com/documentation/en-us/unreal-engine/pixel-streaming-infrastructure
- Epic hardware/network reference: https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-pixel-streaming-reference
- Three.js PBR material contract: https://threejs.org/docs/pages/MeshStandardMaterial.html
- Three.js clearcoat model: https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- Three.js PMREM contract: https://threejs.org/docs/pages/PMREMGenerator.html
- Three.js color management: https://threejs.org/manual/en/color-management.html

## 2. Visual pillars

### V1. Premium ABS, not flat colored boxes

- Opaque plastic uses dielectric PBR: `metalness 0`, roughness 0.24, clearcoat 0.72, clearcoat roughness 0.15.
- Matte road/black utility parts use roughness 0.74 and only a trace clearcoat.
- Metal uses metalness 0.72 and roughness 0.22; it must remain a minority accent.
- Glass uses a physical clearcoat surface with transparent blending, depth write disabled and no fake opaque gray slab.
- Stud and tile bump remains procedural and carries no external texture or runtime request.

Acceptance: a release frame must contain at least 12 unique `MeshPhysicalMaterial` instances. The 2026-08-20 baseline contains 236.

### V2. Edge highlights define scale

Perfectly sharp boxes read as unfinished CG. The r150 MIT `RoundedBoxGeometry` addon is adapted to the classic runtime and used only where the player notices it:

- close first-person hands and equipment;
- police-station facade components;
- red SUV and police car;
- reusable brick bodies.

Large skyline massing, long beams and low-value background geometry keep ordinary boxes. This preserves a strong silhouette and triangle budget.

Acceptance: at least 12 unique rounded geometries in a golden frame; baseline 55. Whole-frame triangles must remain at or below 125,000 in the current smoke scene and below 200,000 in the future worst-wave gate.

### V3. Outdoor product-lighting response

The runtime generates a small reflection-only environment once at startup:

- warm key card;
- cool fill card;
- overhead white card;
- blue sky room and muted green ground bounce.

`PMREMGenerator` prefilters this environment for roughness-aware reflections. The environment scene and source geometry are disposed after baking; only the render target remains. Direct sunlight still supplies the readable cast shadow. A cool fill separates shadow-side blue and black parts without flattening the scene.

Renderer contract:

| Parameter | Value |
|---|---:|
| Tone mapping | ACES Filmic |
| Exposure | 1.08 |
| Output encoding | sRGB |
| Shadow map | PCF Soft, 1536² |
| Sun intensity | 1.62 |
| Hemisphere intensity | 0.64 |
| Fill intensity | 0.20 |

### V4. Miniature lens cue without combat blur

Depth of field is a scale cue, not a license to hide threats. The previous 7.5 px maximum blur and 0.62 aperture visibly obscured enemies and the city.

Current high-quality/readability contract at 900 px render height:

| Parameter | Value | CI maximum |
|---|---:|---:|
| Aperture | 0.24 | 0.30 |
| Maximum blur | 3.2 px | 4.5 px |
| Vignette | 0.07 | 0.10 |
| Saturation | 1.04 | — |

The first-person hands remain a separate sharp pass. Reduced-motion and explicit DoF controls remain required before the accessibility milestone can be marked complete.

### V5. City hierarchy

Every production camera must read in this order:

1. immediate threat/objective;
2. interactive foreground and crosswalk;
3. police outpost landmark;
4. vehicles, citizens and street props;
5. skyline, crane and sky.

Rules:

- blue/white police architecture is the anchor, not a full-screen color wash;
- road value stays darker than sidewalks and characters;
- red and magenta are threat/vehicle accents and cannot dominate the full frame;
- skyline is lower contrast and lower detail than the play lane;
- bloom, chromatic aberration, heavy outlines and uncontrolled motion blur are prohibited by default;
- no external asset may introduce a realistic human, weapon gore, official logo or ripped franchise geometry.

## 3. Unreal Engine 5.8 handoff contract

UE is useful only when it produces evidence that the web runtime can consume.

### Reference scene

Create one neutral turntable containing:

- 2×4 red plastic brick;
- white tile;
- dark-gray matte road tile;
- transparent blue window;
- silver/gold metal accent;
- one minifigure-scale vehicle corner.

Use a neutral 18% gray floor, a warm key, cool fill and overhead soft source. Disable cinematic bloom and lens dirt. Capture 2048×2048 front, 3/4, grazing and backlit views.

### Calibration targets

- Base color values come from `src/bricks.js`; do not eyeball a second palette.
- Plastic metallic = 0; perceptual roughness target 0.22–0.30; clearcoat target 0.6–0.8.
- Edge radius target is 0.5–1.0% of the shortest visible part dimension, clamped for tiny plates.
- Compare highlight width and shadow-side separation, not absolute UE exposure.
- Exported normal/AO/roughness maps must be power-of-two, documented, hashed and tested after KTX2 conversion before use.

### Rejection rule

An Unreal beauty render is not implementation evidence. A change is accepted only after the equivalent WebGL frame passes the browser visual contract and budgets on the public build.

## 4. External source strategy

No external model or HDRI is shipped in the 2026-08-20 PBR milestone. The procedural reflection rig avoids a new loader, cross-origin failure under `file://`, and payload growth. Candidates remain quarantined until exact-file review:

| Candidate | Intended use | License evidence | Current decision |
|---|---|---|---|
| Kenney Brick Kit / City kits | secondary props and silhouette study | CC0 on exact asset page | evaluate after glTF loader migration |
| Quaternius Downtown City MegaKit | modular facade/prop benchmark | CC0, glTF/FBX/Blend | benchmark only; do not mix style wholesale |
| Poly Haven outdoor HDRI | optional reflection bake | all assets CC0 | prefer 1K offline bake; no runtime addition yet |
| ambientCG materials | road/concrete reference | CC0 | use only if stylized down to the art bible |

Primary asset evidence:

- Kenney City Kit: https://kenney.nl/assets/city-kit-commercial
- Quaternius Downtown City MegaKit: https://quaternius.com/packs/downtowncitymegakit.html
- Poly Haven license: https://polyhaven.com/license
- Poly Haven Suburban Field 02: https://polyhaven.com/a/suburban_field_02
- ambientCG license: https://docs.ambientcg.com/license/

Intake remains file-specific. URL, author, version, download date, original/processed SHA-256, SPDX license, modification and redistribution decision are mandatory. `unknown`, `NC` and `ND` are rejected. Candidate screenshots and website logos are not assets and may not be copied.

## 5. Golden views and automated gates

The smoke suite creates these required views at 1400×900:

- first-person street establishing shot;
- threat group in the play lane;
- all three weapons and three skills;
- close hand/equipment views;
- police-station three-quarter view;
- support-choice overlay.

For the measured police-station view the browser downsamples the rendered canvas to 160×90 and calculates luminance statistics. Release limits:

| Metric | Allowed |
|---|---:|
| Mean luminance | 0.30–0.86 |
| Luminance standard deviation | ≥ 0.12 |
| Pixels above 0.985 luminance | ≤ 28% |
| Pixels below 0.025 luminance | ≤ 18% |
| ACES / scene environment | must be active |
| Console / page error | 0 |

Baseline on Edge 151 + SwiftShader, 2026-08-20:

- mean luminance 0.6408;
- luminance standard deviation 0.2344;
- clipped 0.0001;
- crushed 0;
- 538 calls, 109,220 triangles;
- 236 physical materials, 55 rounded geometries;
- all gameplay, defense, storage-denied and pool-overflow regressions passed.

Local hardware probe on Edge 151 used ANGLE D3D11 on an NVIDIA GeForce RTX 4070 Ti and held the browser's 60 FPS ceiling while passing the same contract at 523 calls and 108,180 triangles. This is a valid result for that machine only, not the target-hardware matrix.

SwiftShader FPS is explicitly not a hardware performance claim. Hardware acceptance still requires the matrix in `QA_PERFORMANCE_RELEASE_GATES.md`.

## 6. Delivery sequence

### Completed — PBR foundation

- physical ABS/matte/glass/metal finishes;
- procedural PMREM environment;
- ACES exposure contract;
- selective bevel geometry;
- reduced combat-obscuring DoF;
- structural and pixel-level browser gate;
- static URL and `file://` compatibility preserved.

### Next — city art pass

1. Author a 12-view reference board and assign one owner/acceptance note per view.
2. Replace repeated facade window textures with atlas/instancing only when the measured draw-call delta is neutral or better.
3. Add 3 street micro-stories per block: repair, delivery, queue, cleanup or traffic response.
4. Add decal/roughness variation at low amplitude; no photoreal grime pasted onto toy plastic.
5. Validate 720p low, 1080p high, 1440p and 4K/DPR2 on real GPU hardware.
6. Only then evaluate one exact CC0 prop pack through the manifest gate.

## 7. Definition of done

A graphics milestone is complete only when:

- every shipped external or adapted asset is in `assets/third-party-assets.json` with a matching hash and notice;
- the static quality gate passes;
- the full browser smoke and visual contract pass;
- golden views are inspected for threat, objective, landmark and hand readability;
- draw-call, triangle, payload and pixel statistics are recorded;
- public Pages reports the same commit SHA as the repository;
- live URL smoke passes after deployment;
- no claim of target-hardware FPS is made without a real hardware run.
