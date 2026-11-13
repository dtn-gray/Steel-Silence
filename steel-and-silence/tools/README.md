# Character source

The duelist is an original sculpt generated with Blender 4.3. No downloaded
character assets, external model requests, or runtime modeling are required.
The game loads the compact, checked-in `dist/human-data.js` mesh and animates it
with `dist/human-skin.js`. Both fighters share its topology and have independent
skeletons and colors. Clothing panels and small accessories are authored in
`human-skin.js`, `coat.js`, and `fighter3d.js`.

Hair is part of the scalp surface, so no separate cap overlaps the head. The
coat uses the current interpolated lower-body mesh to build separating planes
for its full triangles. Its lining also respects that clearance. Open front
panels and side vents give the legs room during wide stances. This calculation
runs in every graphics mode and has no time-stepped cloth state to lag behind
the body. `tests/clipping.test.mjs` checks mesh intersections during combat,
dash, guard cancels, falls, and round resets.

The ankle weights keep the calf on the lower-leg bone and the heel and toe on
its foot bone, with a short blend around the ankle. Living feet limit twist
and stay flat when planted; fallen feet follow the shin. The matching checks
are in `tests/ankle.test.mjs`.

To edit the body proportions or skin weights, modify `build_human.py`, then run:

```sh
blender -b --python tools/build_human.py
```

To also save an editable sculpt:

```sh
blender -b --python tools/build_human.py -- --blend duelist-sculpt.blend
```

Blender is only needed to rebuild the sculpt. Playing, editing the game code,
and deploying the website require no Blender installation or build step.
