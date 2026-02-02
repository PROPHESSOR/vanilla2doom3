<script setup lang="ts">
import { ref, computed, toRaw } from 'vue';
import { WadParser } from './core/WadParser';
import { MapParser } from './core/MapParser';
import { readByteToolsBufferFromInput } from './core/utils/BrowserFile';

interface MapChoice {
  name: string;
  index: number;
}

const wadParser = ref<WadParser | null>(null);
const mapParser = ref<MapParser | null>(null);
const maps = ref<MapChoice[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

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
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to parse map';
  }
}

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
</script>

<template>
  <div class="app">
    <h1>Vanilla2Doom3</h1>

    <div v-if="error" class="error">{{ error }}</div>

    <!-- Step 1: Select WAD -->
    <section v-if="!wadParser" class="step">
      <label class="file-label">
        <span>Select WAD file</span>
        <input
          type="file"
          accept=".wad"
          :disabled="loading"
          @change="onWadSelected"
        />
      </label>
      <p v-if="loading" class="muted">Parsing WAD…</p>
    </section>

    <!-- Step 2: Choose map -->
    <section v-if="wadParser && !mapParser" class="step">
      <h2>Choose map</h2>
      <ul class="map-list">
        <li
          v-for="choice in maps"
          :key="choice.index"
        >
          <button type="button" @click="selectMap(choice)">{{ choice.name }}</button>
        </li>
      </ul>
      <p v-if="!maps.length" class="muted">No maps found in this WAD.</p>
    </section>

    <!-- Step 3: Map view (linedefs) -->
    <section v-if="mapParser" class="step">
      <div class="map-view">
        <svg
          v-if="mapBounds"
          :viewBox="svgViewBox"
          preserveAspectRatio="xMidYMid meet"
          class="map-svg"
        >
          <line
            v-for="(ld, i) in mapParser.linedefs"
            :key="i"
            :x1="ld.vertex1 ? parseFloat(ld.vertex1.x) : 0"
            :y1="ld.vertex1 ? svgY(parseFloat(ld.vertex1.y)) : 0"
            :x2="ld.vertex2 ? parseFloat(ld.vertex2.x) : 0"
            :y2="ld.vertex2 ? svgY(parseFloat(ld.vertex2.y)) : 0"
            class="linedef"
          />
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

.linedef {
  stroke: #8bc34a;
  stroke-width: 1;
  fill: none;
}
</style>
