// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { MapParser } from '../../idTech1/MapParser';
import type { Doom3Map } from '../../idTech4/Doom3Map';
import type { Action } from '../Action';
import { mapX, mapY, mapZ } from '../../constants';

interface ThingMapping {
  classname: string;
  properties?: Record<string, string>;
  zOffset?: number; // Additional Z offset from floor
}

// Comprehensive mapping of Doom thing types to Doom 3 entities
const THING_MAPPINGS: Record<number, ThingMapping> = {
  // ========== Player Starts ==========
  1: { classname: 'info_player_start' },
  2: { classname: 'info_player_deathmatch' },
  3: { classname: 'info_player_deathmatch' },
  4: { classname: 'info_player_deathmatch' },
  11: { classname: 'info_player_deathmatch' },

  // ========== Keys ==========
  5: { classname: 'item_key_blue', properties: { 'model': 'models/items/keys/key_blue.lwo' } },
  13: { classname: 'item_key_red', properties: { 'model': 'models/items/keys/key_red.lwo' } },
  6: { classname: 'item_key_yellow', properties: { 'model': 'models/items/keys/key_yellow.lwo' } },

  // ========== Weapons ==========
  2001: { classname: 'weapon_shotgun' },
  2002: { classname: 'weapon_chaingun' },
  2003: { classname: 'weapon_rocketlauncher' },
  2004: { classname: 'weapon_plasmagun' },
  2005: { classname: 'weapon_chainsaw' },
  2006: { classname: 'weapon_bfg' },

  // ========== Ammunition ==========
  2007: { classname: 'item_clip_small' }, // Clip
  2008: { classname: 'item_shells_small' }, // 4 shotgun shells
  2010: { classname: 'item_rockets_small' }, // Rocket
  2046: { classname: 'item_clip_box' }, // Box of bullets
  2047: { classname: 'item_cells_small' }, // Cell pack
  2048: { classname: 'item_shells_large' }, // Box of shells
  2049: { classname: 'item_clip_large' }, // Box of ammo

  // ========== Health & Armor ==========
  2011: { classname: 'item_health_small' }, // Stimpack
  2012: { classname: 'item_health' }, // Medikit
  2013: { classname: 'item_health_mega' }, // Soulsphere
  2014: { classname: 'item_health_large' }, // Health bonus (+1)
  2015: { classname: 'item_health_mega' }, // Invulnerability (placeholder)
  2018: { classname: 'item_armor_small' }, // Green armor
  2019: { classname: 'item_armor_large' }, // Blue armor
  2045: { classname: 'item_armor_security' }, // Bonus armor

  // ========== Powerups ==========
  2022: { classname: 'item_envirosuit' }, // Invulnerability (mapped to enviro suit)
  2023: { classname: 'item_berserk' }, // Berserk
  2024: { classname: 'item_envirosuit' }, // Blur sphere (invis, mapped to enviro)
  2025: { classname: 'item_envirosuit' }, // Radiation suit
  2026: { classname: 'item_health_mega' }, // Computer map (placeholder)

  // ========== Monsters - Former Humans ==========
  3004: { classname: 'monster_zsec_pistol', zOffset: 0 }, // Zombieman
  9: { classname: 'monster_zsec_shotgun', zOffset: 0 }, // Shotgun guy
  3001: { classname: 'monster_demon_imp', zOffset: 0 }, // Imp
  3002: { classname: 'monster_demon_pinky', zOffset: 0 }, // Demon/Pinky
  58: { classname: 'monster_demon_pinky', zOffset: 0 }, // Spectre (invisible pinky)

  // ========== Monsters - Advanced ==========
  3003: { classname: 'monster_demon_hellknight', zOffset: 0 }, // Baron of Hell
  3005: { classname: 'monster_flying_cacodemon', zOffset: 0 }, // Cacodemon
  3006: { classname: 'monster_flying_lostsoul', zOffset: 0 }, // Lost Soul
  16: { classname: 'monster_demon_revenant', zOffset: 0 }, // Cyberdemon (mapped to revenant)
  7: { classname: 'monster_demon_mancubus', zOffset: 0 }, // Spider Mastermind (mapped to mancubus)

  // ========== Monsters - Mid Tier ==========
  65: { classname: 'monster_zombie_chainsaw', zOffset: 0 }, // Chaingunner
  69: { classname: 'monster_demon_hellknight', zOffset: 0 }, // Hell Knight
  64: { classname: 'monster_demon_archvile', zOffset: 0 }, // Archvile
  68: { classname: 'monster_demon_trite', zOffset: 0 }, // Arachnotron (mapped to trite as placeholder)
  71: { classname: 'monster_flying_cacodemon', zOffset: 0 }, // Pain Elemental (mapped to cacodemon)
  66: { classname: 'monster_demon_revenant', zOffset: 0 }, // Revenant
  67: { classname: 'monster_demon_mancubus', zOffset: 0 }, // Mancubus

  // ========== Decorations ==========
  2035: { classname: 'light', properties: { 'light_radius': '200 200 200', '_color': '1 0.8 0.6' } }, // Barrel
  48: { classname: 'light', properties: { 'light_radius': '150 150 150', '_color': '0.8 0.8 1' }, zOffset: 48 }, // Tall techno pillar
  30: { classname: 'light', properties: { 'light_radius': '100 100 100', '_color': '1 1 1' }, zOffset: 48 }, // Short green pillar
  85: { classname: 'light', properties: { 'light_radius': '120 120 120', '_color': '1 0.8 0.6' }, zOffset: 56 }, // Tall red torch
  86: { classname: 'light', properties: { 'light_radius': '120 120 120', '_color': '1 0.8 0.6' }, zOffset: 40 }, // Short red torch
};

export interface ThingActionOptions {
  includeMonsters?: boolean;
  includeItems?: boolean;
  includeDecorations?: boolean;
}

export class ThingAction implements Action {
  name = 'ThingAction';

  private includeMonsters: boolean;
  private includeItems: boolean;
  private includeDecorations: boolean;
  private mapParser: MapParser | null = null;

  constructor(options: ThingActionOptions = {}) {
    this.includeMonsters = options.includeMonsters ?? true;
    this.includeItems = options.includeItems ?? true;
    this.includeDecorations = options.includeDecorations ?? true;
  }

  preprocess(map: MapParser): void {
    // Store the map parser instance for later use in postprocess
    this.mapParser = map;
  }

  postprocess(doom3Map: Doom3Map): void {
    if (!this.mapParser) {
      console.warn('[ThingAction] No MapParser instance found, skipping thing conversion');
      return;
    }

    const mapParser = this.mapParser;

    const things = mapParser.things ?? [];
    const sectors = mapParser.sectors ?? [];
    let convertedCount = 0;

    for (const thing of things) {
      const mapping = THING_MAPPINGS[thing.type];
      if (!mapping) {
        console.log(`[ThingAction] No mapping for thing type ${thing.type} at (${thing.x}, ${thing.y})`);
        continue;
      }

      // Filter based on options
      if (!this.shouldIncludeThing(thing.type)) {
        continue;
      }

      // Find the floor height at this thing's location
      const floorHeight = this.findFloorHeightAt(thing.x, thing.y, sectors);
      const zOffset = mapping.zOffset ?? 0;
      const z = mapZ(floorHeight) + zOffset;

      // Convert Doom angle (0=east, 90=north) to Doom 3 angle (0=east, 90=north, CCW)
      const angle = this.convertAngle(thing.angle);

      const entity = {
        classname: mapping.classname,
        properties: {
          name: `${mapping.classname}_${thing._id}`,
          origin: `${mapX(thing.x)} ${mapY(thing.y)} ${z}`,
          angle: angle.toString(),
          ...(mapping.properties ?? {}),
        },
        brushes: [],
      };

      doom3Map.addEntity(entity);
      convertedCount++;
    }

    console.log(`[ThingAction] Converted ${convertedCount} things to Doom 3 entities`);
  }

  private shouldIncludeThing(thingType: number): boolean {
    // Player starts are always included
    if ([1, 2, 3, 4, 11].includes(thingType)) return true;

    // Check monster types (3000-3999 range and some specific ones)
    const monsterTypes = [3004, 9, 3001, 3002, 58, 3003, 3005, 3006, 16, 7, 65, 69, 64, 68, 71, 66, 67];
    if (monsterTypes.includes(thingType)) {
      return this.includeMonsters;
    }

    // Check item types (weapons, ammo, health, armor - 2000-2049 range)
    if (thingType >= 2000 && thingType <= 2049) {
      return this.includeItems;
    }

    // Check decoration types
    const decorationTypes = [2035, 48, 30, 85, 86];
    if (decorationTypes.includes(thingType)) {
      return this.includeDecorations;
    }

    return true;
  }

  private findFloorHeightAt(x: number, y: number, sectors: typeof MapParser.prototype.sectors): number {
    // Find which sector contains this point
    // For now, use a simple approach: return the first sector's floor height
    // In a more complete implementation, we'd do proper point-in-polygon testing
    if (!sectors || sectors.length === 0) return 0;

    // Try to find the sector by checking subsectors
    for (const sector of sectors) {
      const subsectors = sector.map.subsectors ?? [];
      for (const subsector of subsectors) {
        if (subsector.sectorIndex === sector._id) {
          const polygon = subsector.getPolygonPoints();
          if (this.pointInPolygon(x, y, polygon)) {
            return sector.heightfloor;
          }
        }
      }
    }

    // Fallback to first sector
    return sectors[0]?.heightfloor ?? 0;
  }

  private pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const pi = polygon[i];
      const pj = polygon[j];
      if (!pi || !pj) continue;

      const xi = pi.x;
      const yi = pi.y;
      const xj = pj.x;
      const yj = pj.y;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private convertAngle(doomAngle: number): number {
    // Doom angles: 0=east, 90=north, 180=west, 270=south
    // Doom 3 angles: same convention (0=east, counter-clockwise)
    return doomAngle;
  }
}
