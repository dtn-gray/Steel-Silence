# Steel & Silence

The complete, editable version of the sword-dueling game. The game uses HTML, CSS, JavaScript modules, WebGL, Three.js, and Web Audio. Three.js r170 is
vendored under dist/vendor with its MIT license. No package installation, build
step, database, backend service, or API keys are needed. A browser with WebGL 2
and hardware acceleration is required to play.

## Open the project in VS Code

1. Extract the ZIP first.
2. In VS Code, choose **File → Open Folder** and select `steel-and-silence`, the
   folder containing this README and `package.json`. You can also open the
   included `Steel-and-Silence.code-workspace` file.
3. Install a current **Node.js LTS** release from https://nodejs.org if Node is
   not already installed. This project requires Node.js 20 or newer. Restart
   VS Code after installing it.
4. Choose **Terminal → New Terminal** and run:

   ```sh
   npm run dev
   ```

5. Visit **http://localhost:5173**. Stop the server with **Ctrl+C**.

There is no `npm install` step: the development server uses Node's built-in
modules. Serve the game through this local URL instead of double-clicking
`index.html`; browsers restrict JavaScript modules opened as local files.

If port 5173 is already in use:

```sh
npm run dev -- --port 5174
```

Then open the new URL printed in the terminal. You can also use VS Code's
**Terminal → Run Task → Start game locally** command.

## Edit the game

The files under `dist/` are the actual editable source and are also ready to
publish. There is no generated bundle to rebuild. Edit a file, save it, and
refresh the browser.

```text
steel-and-silence/
  dist/
    index.html       HUD and controls
    style.css        Responsive UI
    game.js          Browser entry point
    app.js           Input, modes, health bars and game flow
    engine.js        3D movement, AI, animation, and combat
    math3d.js        Spatial geometry and inverse kinematics
    render.js        Adaptive WebGL renderer, lighting and camera
    batching.js      Static scenery batches and fighter instances
    quality.js       Graphics profiles and automatic scaling
    fighter3d.js     Hats, weapons and accessories
    human-skin.js    Skeletal deformation and seamless scalp hair
    coat.js          Coat panels with clearance from the posed legs
    human-data.js    Original sculpted, weighted human mesh
    arena.js         Procedural 3D courtyard
    audio.js         Synthesized sounds
    fonts/           Local Cinzel and Crimson Pro fonts and licenses
    vendor/          Three.js and its MIT license
  tools/             Original Blender model generator and instructions
  scripts/serve.mjs   Local server
  tests/             Combat, spatial movement and model tests
  .vscode/tasks.json VS Code tasks
  package.json
  netlify.toml
  Steel-and-Silence.code-workspace
  README.md
```

For example, edit `MOVES` in `dist/engine.js` to tune attack speed, stamina
cost, and damage. Edit `themes` in `dist/fighter3d.js` to change the
fighters' colors.

Run the included checks with:

```sh
npm test
```

Cinzel and Crimson Pro are served locally from `dist/fonts/`, with their
SIL Open Font Licenses. There are no external font requests. The game logic
and visuals are local.
Sound starts only after a click, tap, or keypress. Preferences are saved in
the browser's local storage.

## Deploy: easiest option (Netlify Drop)

No Git repository, terminal deployment command, or build is required.

1. Sign in to Netlify at https://app.netlify.com.
2. Open **https://app.netlify.com/drop**.
3. Drag the **`dist` folder** onto the upload area. This is the folder with
   `index.html` directly inside it. Do not upload the whole project folder.
4. Netlify publishes it and gives you an HTTPS web address to share.
5. For later updates, edit and save your files, then upload `dist` again in
   that same Netlify project's **Deploys** page to keep the same web address.

This creates a separate deployment from the existing ChatGPT-hosted game.
Netlify's default deployment is publicly accessible. A local development
server is only available on your own computer; stopping it does not affect
an uploaded Netlify deployment.

## Deploy from a GitHub repository (automatic updates)

1. Create a GitHub repository and upload the contents of this project folder.
   `package.json`, `netlify.toml`, and `dist/` should be at the repository root.
2. In Netlify, choose the option to import a project from Git and connect the
   repository.
3. Use these settings:

   - Base directory: leave empty
   - Build command: leave empty
   - Publish directory: `dist`

4. Deploy. Future pushes to the production branch redeploy the game.

The included `netlify.toml` also declares `dist` as the publish directory.
The local server in `scripts/serve.mjs` is a development convenience; Netlify
serves the static files directly and does not run `npm start`.

Other hosts work too: choose static-site hosting and publish the contents of
`dist`, with no build command. Configure `dist` as the output/publish directory
when the host asks for one. GitHub Pages, for example, can serve these files
from a repository root, a `docs` folder, or a Pages Actions deployment;
selecting an arbitrary `dist` folder in its branch settings is not supported.

## Graphics and performance

The **Graphics** selector above the arena has three settings:

- **Auto** starts with a moderate pixel budget, or a lighter one on smaller
  devices, and reduces resolution/effects if sustained frame times are slow.
- **Fast** uses the lowest resolution, simple contact shadows, and minimal
  effects. Choose this if play is still laggy.
- **High** adds live fighter shadows and a higher resolution.

Rendering is capped at 60 frames per second during a duel and 20 on paused/menu
screens. Hidden tabs stop rendering. Combat still uses a fixed 120 Hz simulation,
independent of the graphics setting. The renderer batches the courtyard and
fighter accessories, shares geometry, and reuses animation buffers. Each fighter
has a continuous, smoothly weighted human body with natural proportions, shaped
facial features, gloves, and boots. The 19-bone skeleton follows the same combat
rig, including attacks, guard cancellations, directional dashes, hit reactions, and falls.
The sculpt is baked ahead of time; there is no texture download or model
loader. Hair uses the scalp surface itself, so a rigid hair cap cannot clip
through the head. Split coat panels calculate clearance from the current posed
leg mesh, including their full triangles and lining, in every graphics mode.
The front opening and side vents leave room for wide stances. There is no
time-stepped cloth simulation to lag behind attacks, dashes, or falls. The original Blender generator
and optional sculpt-editing instructions are included under `tools/`.

## Screen layout

The page uses the browser's current viewport height. The arena gets the remaining
space after the header and mode/settings bar, with no page scrolling. The camera
adapts to the canvas shape and preserves the horizontal duel view on portrait
screens. Rendering still respects the selected graphics profile's pixel budget.
The keyboard guide is available through **Controls**. Touch action buttons sit
inside the arena on phones. The project download is in the header.

The revised ankle weighting keeps the calf aligned with the shin and the heel
and sole stable, with a short transition at the ankle. Planted feet stay level;
foot twist is limited, and fallen feet follow the lower leg.

## Controls

Select **2 Players** for a local match on one keyboard, **vs CPU** to play the
computer, or **Practice** for an opponent that guards but never attacks.

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Retreat / advance | A / D | Right / Left arrows |
| Sidestep up / down | W / S | Up / Down arrows |
| High / low guard | Q / E | U / O |
| Attack | F | K |
| Dash | Space | Right Shift |
| Pause / resume | Esc | Esc |

Player 2 controls are active only in 2 Players mode. Each fighter has a single
attack button. A high guard makes a high cut, and a low guard makes a low cut.
Guard selection stays active after releasing the key. W/S or Up/Down circles the
opponent. Distance and blade contact use all three dimensions; a well-timed
outside sidestep can evade a committed cut. The camera follows the duel. Dash follows your movement, including diagonals;
with no movement it uses residual momentum, or goes forward from a standstill.
The dash direction stays fixed for its short burst. Dashing costs stamina and
can be interrupted by a hit. The sword has a longer, broader blade, and both
cuts use a wider backswing. Switch to the **opposite guard during a cut** to
cancel it, clear its queued follow-up and blade trail, and smoothly return to
the new guard. This works during the wind-up, active swing, follow-through, and
recovery. Selecting the same guard leaves the cut running. The cancelled
attack's stamina stays spent; switching guards has no extra stamina cost.
Damage already dealt remains. After a short recovery, press Attack again for
a cut from the newly selected guard. This uses Q/E for Player 1, U/O for Player 2,
and the High/Low buttons on touch screens. G and L have no action.

Each fighter begins a round with 100 health. High cuts deal 34 damage and low
cuts deal 28. A matching guard blocks the cut; tapping guard just before contact
can produce a perfect parry. Blocking costs stamina. A hit interrupts an attack,
clears its queued follow-up, and briefly staggers the fighter. Health does not
regenerate during a round; stamina does. Empty the opponent's health bar to win
a round. Win 3 rounds to win the match. Health resets between rounds.

Touch controls use the same guard selection and single attack button in solo
modes. Two-player mode uses the keyboard.
