# vanilla2doom3

<a href="https://github.com/user-attachments/assets/653f48ba-9229-4aa9-a2c9-10cdb74923ed">
<img width="480" alt="Vanilla2Doom3 UI" src="https://github.com/user-attachments/assets/653f48ba-9229-4aa9-a2c9-10cdb74923ed" />
</a><br/>

<a href="https://github.com/user-attachments/assets/cbdcb305-82c8-4280-ae6a-d668a9848711"><img width="480" alt="Converted game map example" src="https://github.com/user-attachments/assets/cbdcb305-82c8-4280-ae6a-d668a9848711" /></a>
<a href="https://github.com/user-attachments/assets/254fcdf4-6df4-4abc-a1f1-71de1d60420b"><img width="480" alt="Converted game map example" src="https://github.com/user-attachments/assets/254fcdf4-6df4-4abc-a1f1-71de1d60420b" /></a>



`vanilla2doom3` is a browser-based converter for classic Doom WAD maps. It reads Doom 1-2-era id Tech 1 map data from a WAD, previews the parsed map geometry, and exports a Doom 3 `Version 2` `.map` file made from `brushDef3` world geometry and entities.

The project is a Vue 3 + Vite application written in TypeScript. WAD parsing and map generation run locally in the browser; the selected WAD files are not uploaded anywhere.

## What It Converts

- Doom WAD directory and map lumps (`THINGS`, `LINEDEFS`, `SIDEDEFS`, `VERTEXES`, `SECTORS`).
- Map subsectors generated from linedef geometry through a TypeScript port of Andrew Apted's AJBSP node builder.
- Sector floors and ceilings into Doom 3 slab brushes.
- One-sided linedefs into full-height wall brushes.
- Two-sided linedefs into upper/lower step wall brushes where adjacent floor or ceiling heights differ.
- Doom texture names into Doom 3 material paths such as `textures/v2d3/STONE1`.
- Texture offsets and texture dimensions when a base IWAD is supplied.
- Player starts, weapons, ammo, keys, health, armor, selected monsters, and selected decorative things into Doom 3 entities.
- Classic door linedef specials into `func_door` entities.
- Sound-blocking linedefs into `func_portal` entities with `nosound`.
- Doom sector light levels into Doom 3 light entities.

The exporter also adds a sealing box around the generated level to help produce a loadable Doom 3 map.

## Current Limits

This is a practical converter, not a full compatibility layer for Doom gameplay.

- It exports Doom 3 editor map geometry, not a finished `.pk4`.
- It does not include copyrighted WAD data, Doom textures, or Doom 3 assets. You need to generate base pk4 from IWAD manually.
- Thing conversion is mapping-based and incomplete; unsupported thing types are skipped.
- Doom linedef specials are only partially interpreted. Doors and sound blockers have explicit support.
- Sector effects, animated textures, triggers, lifts, switches, teleports, monster behavior parity, and full gameplay scripting are outside the current conversion scope.
- Dynamic lights placement is in very early stage.

## Web App Usage

Install dependencies:

```sh
deno install
```

Start the development server:

```sh
deno task dev
```

And go to `http://localhost:3666`

In the app:

1. Select a map WAD.
2. Leave `Use current WAD as IWAD` enabled for self-contained WADs, or disable it and select a base IWAD when the map depends on external texture definitions.
3. Click `Load`.
4. Choose a map marker such as `E1M1` or `MAP01`.
5. Inspect the parsed subsector preview.
6. Click `Export Doom 3 .map` to download `converted.map`.

The app stores the last parsed map snapshot in `localStorage` so it can be reloaded without reselecting the WAD.

## Texture And Material Extraction

The browser exporter references Doom 3 material names, but it does not extract texture images. The `resourcepack/` directory contains a Deno utility that extracts wall textures and flats from a WAD as TGA files and writes a Doom 3 material file.

Run it with Deno:

```sh
cd resourcepack
deno task extract /path/to/DOOM.WAD --out=./output --prefix=v2d3
```

The output layout is:

```text
output/
  materials/
    v2d3.mtr
  textures/
    v2d3/
      *.tga
```

Copy or package those generated files according to your Doom 3 mod workflow. The `--prefix` value should match the texture prefix used by the map exporter; the default is `v2d3`.

## Project Layout

- `src/App.vue` - browser UI for selecting WADs, previewing maps, and exporting `.map` files.
- `src/idTech1/` - WAD parsing, Doom map structures, texture size parsing, and nodebuilder integration.
- `src/idTech1/nodebuilder/` - TypeScript port of AJBSP used to build subsectors from geometry.
- `src/idTech4/` - Doom 3 map, brush, coordinate, and export helpers.
- `src/processing/` - conversion actions for doors, things, sound blockers, lighting, and other post-processing.
- `resourcepack/` - Deno texture/material extraction tools.

## Development Commands

```sh
deno task dev
```

Run Vite for local development.

```sh
deno task build
```

Type-check and build the production app.

```sh
deno task lint
```

Run oxlint and ESLint with automatic fixes.

```sh
deno task format
```

Format files under `src/` with Prettier.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- Deno, (especially for the `resourcepack/` extraction utility)

## Attribution

The nodebuilder is a TypeScript port of Andrew Apted's AJBSP for this project.

Original AJBSP project: <https://gitlab.com/andwj/ajbsp>
