// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { MapParser } from '../idTech1/MapParser';
import type { Doom3Map } from '../idTech4/Doom3Map';
import type { Action } from './Action';

export class MapProcessor {
  private actions: Action[];

  constructor(actions: Action[]) {
    this.actions = actions;
  }

  preprocess(map: MapParser): void {
    for (const action of this.actions) {
      if (action.preprocess) {
        console.log(`[MapProcessor] Running preprocess: ${action.name}`);
        action.preprocess(map);
      }
    }
  }

  postprocess(doom3Map: Doom3Map): void {
    for (const action of this.actions) {
      if (action.postprocess) {
        console.log(`[MapProcessor] Running postprocess: ${action.name}`);
        action.postprocess(doom3Map);
      }
    }
  }
}
