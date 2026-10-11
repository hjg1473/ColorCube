# Color Cube

A dichroic glass cube (an "X-cube" prism) rendered in the browser with [three.js](https://threejs.org).
The glass is see-through but tinted, and its colour shifts with the viewing angle. It sits on a white garden table on the lawn.

## Controls

| Input | Action |
|---|---|
| Left drag | Rotate the cube (with inertia) |
| Left click on the cube | Spin it |
| Right drag | Orbit the camera |
| Mouse wheel | Zoom in / out |
| Touch: one finger / two fingers | Rotate the cube / orbit + pinch-zoom |

## How the glass works

- **Two render passes.** The scene is first rendered into an off-screen target without the cube's front faces. That includes the back faces and the two diagonal dichroic mirrors inside the cube. The front faces then sample that image with a screen-space refraction offset and slight per-channel dispersion. That's why the background shows through, slightly bent.
- **Dichroic tint.** Each face has a base hue that shifts with the viewing angle (`1 - N·V`). Light passing through is tinted by that hue, and reflections take the complementary colour.
- **Reflections.** A live `CubeCamera` captures the surroundings, and the faces reflect it using Fresnel weighting.
- **Extras.** Bright polished edges, a sun glint, and a coloured caustic on the table that follows the cube's orientation.

## Run locally

It's a static site with no build step. Serve the folder with any static server:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly via `file://` will not work, because browsers block ES modules there.

## Deploy

Enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root) and the site is served as-is.
