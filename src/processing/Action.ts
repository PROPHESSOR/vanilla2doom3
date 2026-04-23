// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { MapParser } from '../idTech1/MapParser';
import type { Doom3Map } from '../idTech4/Doom3Map';

export interface Action {
  name: string;
  preprocess?(map: MapParser): void;
  postprocess?(doom3Map: Doom3Map): void;
}
