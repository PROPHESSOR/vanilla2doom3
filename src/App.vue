<script setup lang="ts">
import { ref, computed, toRaw } from 'vue';
import { WadParser } from './idTech1/WadParser';
import { MapParser, type StoredMap } from './idTech1/MapParser';
import { readByteToolsBufferFromInput } from './idTech1/utils/BrowserFile';
import { generateDoom3Map } from './idTech4';

const LAST_MAP_KEY = 'vanilla2doom3-last-map';

interface MapChoice {
  name: string;
  index: number;
}

const wadParser = ref<WadParser | null>(null);
const mapParser = ref<MapParser | null>(null);
const maps = ref<MapChoice[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);
const hoveredSubsectorIndex = ref<number | null>(null);
const tooltipPos = ref({ x: 0, y: 0 });

(window as any).mapParser = mapParser;
(window as any).wadParser = wadParser;

async function onWadSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input?.files?.length) return;
  error.value = null;
  loading.value = true;
  try {
    const buffer = await readByteToolsBufferFromInput(input);
    if (!buffer) {
      error.value = 'Failed to read file';
      return;
    }
    const wad = new WadParser(buffer);
    await wad.parse();
    wadParser.value = wad;
    maps.value = wad.getMaps().map((l) => ({ name: l.name, index: l.index }));
    mapParser.value = null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to parse WAD';
  } finally {
    loading.value = false;
    input.value = '';
  }
}

function selectMap(choice: MapChoice) {
  const wad = wadParser.value;
  if (!wad) return;
  error.value = null;
  try {
    const parser = new MapParser(toRaw(wad) as WadParser);
    parser.parse(choice.index);
    mapParser.value = parser;
    try {
      localStorage.setItem(LAST_MAP_KEY, JSON.stringify(parser.toStoredMap()));
    } catch {
      /* ignore */
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to parse map';
  }
}

function loadLastMap() {
  error.value = null;
  try {
    const raw = localStorage.getItem(LAST_MAP_KEY);
    if (!raw) return;
    const stored: StoredMap = JSON.parse(raw);
    const parser = new MapParser({} as WadParser);
    parser.loadFromSnapshot(stored);
    mapParser.value = parser;
    wadParser.value = null;
    maps.value = [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load last map';
    try {
      localStorage.removeItem(LAST_MAP_KEY);
    } catch {
      /* ignore */
    }
  }
}

const hasLastMap = (() => {
  try {
    return localStorage.getItem(LAST_MAP_KEY) != null;
  } catch {
    return false;
  }
})();

const mapBounds = computed(() => {
  const mp = mapParser.value;
  const v = mp?.vertexes;
  if (!v?.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const vert of v) {
    const x = parseFloat(vert.x);
    const y = parseFloat(vert.y);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const pad = 32;
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + 2 * pad,
    height: maxY - minY + 2 * pad,
    maxY,
  };
});

const svgViewBox = computed(() => {
  const b = mapBounds.value;
  if (!b) return '0 0 100 100';
  const pad = 32;
  return `${b.minX} ${-b.maxY - pad} ${b.width} ${b.height}`;
});

function svgY(y: number): number {
  return -y;
}

const sectorColors = computed(() => {
  const mp = mapParser.value;
  const n = mp?.sectors?.length ?? 0;
  if (n === 0) return new Map<number, string>();
  const colors = new Map<number, string>();
  for (let i = 0; i < n; i++) {
    const hue = (i * 360) / Math.max(n, 1) % 360;
    colors.set(i, `hsl(${hue}, 70%, 55%)`);
  }
  return colors;
});

function subsectorPolygonPoints(ss: { getPolygonPoints: () => { x: number; y: number }[] }): string {
  const pts = ss.getPolygonPoints();
  if (!pts.length) return '';
  return pts.map((p) => `${p.x},${svgY(p.y)}`).join(' ');
}

function subsectorStrokeColor(sectorIndex: number | undefined): string {
  if (sectorIndex === undefined) return '#fff';
  const fill = sectorColors.value.get(sectorIndex) ?? '#888';
  return fill;
}


const hoveredSubsector = computed(() => {
  const mp = mapParser.value?.subsectors ?? [];
  const i = hoveredSubsectorIndex.value;
  return i != null && i >= 0 && i < mp.length ? mp[i] : null;
});

const hoveredSubsectorVertices = computed(() => {
  const ss = hoveredSubsector.value;
  if (!ss) return [];
  return ss.getPolygonPoints().map((p, i) => ({ _id: i, x: String(p.x), y: String(p.y) }));
});

const hoveredVertexColors = computed(() => {
  const verts = hoveredSubsectorVertices.value;
  const map = new Map<number, string>();
  verts.forEach((v, i) => {
    const hue = (i * 360) / Math.max(verts.length, 1) % 360;
    map.set(v._id, `hsl(${hue}, 85%, 58%)`);
  });
  return map;
});

function getVertexColor(vertexId: number): string {
  return hoveredVertexColors.value.get(vertexId) ?? '#888';
}

interface LineWithVertices {
  v1: { _id: number; x: string; y: string };
  v2: { _id: number; x: string; y: string };
}

const hoveredSubsectorLines = computed<LineWithVertices[]>(() => {
  const ss = hoveredSubsector.value;
  if (!ss) return [];
  const segs = ss.segs;
  return segs
    .map((seg, j) => {
      const v1 = seg.vertex1;
      const v2 = seg.vertex2;
      if (!v1 || !v2) return null;
      return {
        v1: { _id: j, x: v1.x, y: v1.y },
        v2: { _id: (j + 1) % segs.length, x: v2.x, y: v2.y },
      };
    })
    .filter((x): x is LineWithVertices => x != null);
});

function onMapViewMouseMove(e: MouseEvent) {
  tooltipPos.value = { x: e.clientX, y: e.clientY };
}

function setHover(i: number | null) {
  hoveredSubsectorIndex.value = i;
}

function exportDoom3Map() {
  const mp = mapParser.value;
  if (!mp) return;

  try {
    console.log('Generating Doom 3 .map file...');
    const mapContent = generateDoom3Map(toRaw(mp) as MapParser);

    // Create download
    const blob = new Blob([mapContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted.map';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Doom 3 .map file exported successfully');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to generate .map file';
    console.error('Export failed:', e);
  }
}

const VERTEX_CIRCLE_R = 5;
</script>

<template>
  <div class="app">
    <h1>Vanilla2Doom3</h1>

    <div v-if="error" class="error">{{ error }}</div>

    <!-- Step 1: Select WAD -->
    <section v-if="!wadParser && !mapParser" class="step">
      <label class="file-label">
        <span>Select WAD file</span>
        <input type="file" accept=".wad" :disabled="loading" @change="onWadSelected" />
      </label>
      <p v-if="hasLastMap" class="load-last">
        <button type="button" class="btn-secondary" :disabled="loading" @click="loadLastMap">
          Load last map
        </button>
      </p>
      <p v-if="loading" class="muted">Parsing WAD…</p>
    </section>

    <!-- Step 2: Choose map -->
    <section v-if="wadParser && !mapParser" class="step">
      <h2>Choose map</h2>
      <ul class="map-list">
        <li v-for="choice in maps" :key="choice.index">
          <button type="button" @click="selectMap(choice)">{{ choice.name }}</button>
        </li>
      </ul>
      <p v-if="!maps.length" class="muted">No maps found in this WAD.</p>
    </section>

    <!-- Step 3: Map view (linedefs) -->
    <section v-if="mapParser" class="step">
      <div class="actions">
        <button type="button" class="btn-export" @click="exportDoom3Map">
          Export Doom 3 .map
        </button>
      </div>
      <div class="map-view" @mousemove="onMapViewMouseMove">
        <div v-if="hoveredSubsector" class="tooltip"
          :style="{ left: tooltipPos.x + 12 + 'px', top: tooltipPos.y + 12 + 'px' }">
          <div class="tooltip-row"><strong>Subsector</strong> {{ hoveredSubsector._id }}</div>
          <div class="tooltip-row"><strong>Sector</strong> {{ hoveredSubsector.sectorIndex ?? '—' }}</div>
          <div class="tooltip-row tooltip-lines">
            <strong>Lines</strong>
            <ul>
              <li v-for="(line, j) in hoveredSubsectorLines" :key="j" class="tooltip-line">
                <span :style="{ color: getVertexColor(line.v1._id) }">({{ line.v1.x }};{{ line.v1.y }})</span>
                <span>-</span>
                <span :style="{ color: getVertexColor(line.v2._id) }">({{ line.v2.x }};{{ line.v2.y }})</span>
              </li>
            </ul>
          </div>
        </div>
        <svg v-if="mapBounds" :viewBox="svgViewBox" preserveAspectRatio="xMidYMid meet" class="map-svg"
          shape-rendering="crispEdges">
          <g class="linedefs-layer">
            <line v-for="(ld, i) in mapParser.linedefs" :key="'ld-' + i" :x1="ld.vertex1 ? parseFloat(ld.vertex1.x) : 0"
              :y1="ld.vertex1 ? svgY(parseFloat(ld.vertex1.y)) : 0" :x2="ld.vertex2 ? parseFloat(ld.vertex2.x) : 0"
              :y2="ld.vertex2 ? svgY(parseFloat(ld.vertex2.y)) : 0" class="linedef" />
          </g>
          <g class="subsectors-layer">
            <polygon v-for="(ss, i) in (mapParser.subsectors ?? [])" :key="'ss-' + i"
              :points="subsectorPolygonPoints(ss)" :fill="sectorColors.get(ss.sectorIndex ?? -1) ?? '#444'"
              :stroke="subsectorStrokeColor(ss.sectorIndex)"
              :class="['subsector', { 'subsector--hover': hoveredSubsectorIndex === i }]" @mouseenter="setHover(i)"
              @mouseleave="setHover(null)" :title="subsectorPolygonPoints(ss)" />
          </g>
          <g v-if="hoveredSubsector" class="vertices-layer">
            <circle v-for="v in hoveredSubsectorVertices" :key="'v-' + v._id" :cx="parseFloat(v.x)"
              :cy="svgY(parseFloat(v.y))" :r="VERTEX_CIRCLE_R" :fill="getVertexColor(v._id)" :stroke="'#fff'"
              stroke-width="1.5" class="vertex-circle" />
          </g>
        </svg>
      </div>
    </section>
  </div>
</template>

<style scoped>
.app {
  font-family: system-ui, sans-serif;
  padding: 1rem;
  max-width: 960px;
  margin: 0 auto;
  background: #121212;
  color: #e0e0e0;
  min-height: 100vh;
}

h1 {
  margin-top: 0;
  font-size: 1.5rem;
}

h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

.error {
  color: #f44336;
  margin-bottom: 1rem;
}

.step {
  margin-bottom: 1.5rem;
}

.file-label {
  display: inline-flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-label input[type="file"] {
  font-size: 0.9rem;
}

.file-label input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.muted {
  color: #888;
  font-size: 0.9rem;
}

.map-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.map-list li {
  margin: 0;
}

.map-list button {
  padding: 0.5rem 1rem;
  background: #333;
  color: #e0e0e0;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
}

.map-list button:hover {
  background: #444;
}

.load-last {
  margin-top: 0.75rem;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: transparent;
  color: #8bc34a;
  border: 1px solid #8bc34a;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(139, 195, 74, 0.15);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.actions {
  margin-bottom: 1rem;
}

.btn-export {
  padding: 0.6rem 1.2rem;
  background: #2196f3;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
}

.btn-export:hover {
  background: #1976d2;
}

.btn-export:active {
  background: #0d47a1;
}

.map-view {
  width: 100%;
  max-width: 800px;
  aspect-ratio: 4/3;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.map-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.linedefs-layer .linedef {
  stroke: #666;
  stroke-width: 1;
  fill: none;
}

.subsectors-layer .subsector {
  fill-opacity: 0.5;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
}

.subsectors-layer .subsector--hover {
  fill-opacity: 0.85;
  stroke-width: 3;
}

.vertices-layer .vertex-circle {
  vector-effect: non-scaling-stroke;
}

.tooltip {
  position: fixed;
  z-index: 10;
  padding: 0.5rem 0.75rem;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 6px;
  font-size: 0.8rem;
  line-height: 1.4;
  max-width: 320px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.tooltip-row {
  margin-bottom: 0.25rem;
}

.tooltip-row:last-child {
  margin-bottom: 0;
}

.tooltip-lines ul {
  margin: 0.25rem 0 0;
  padding-left: 1rem;
  overflow-y: auto;
}

.tooltip-line {
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  word-break: break-all;
}
</style>
