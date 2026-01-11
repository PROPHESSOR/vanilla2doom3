#!/usr/bin/env python3
"""Extract and analyze problematic primitives 26-27."""

import re

with open('doom2doom3.map', 'r') as f:
    content = f.read()

# Find all brushDef3 sections
brush_pattern = r'brushDef3\s*\{([^}]+)\}'
brushes = list(re.finditer(brush_pattern, content))

print(f"Total brushes found: {len(brushes)}\n")

if len(brushes) >= 27:
    for idx in [25, 26]:  # 0-indexed, so primitives 26-27 are indices 25-26
        if idx < len(brushes):
            match = brushes[idx]
            brush_content = match.group(1)

            # Extract planes
            plane_pattern = r'\(\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\)'
            planes = list(re.finditer(plane_pattern, brush_content))

            print(f"Primitive {idx+1}: {len(planes)} planes")
            for j, p_match in enumerate(planes):
                nx, ny, nz, d = map(float, p_match.groups())
                normal_len = (nx**2 + ny**2 + nz**2)**0.5
                print(f"  Plane {j}: ({nx:.4f}, {ny:.4f}, {nz:.4f}, {d:.1f}) len={normal_len:.4f}")

                # Check for issues
                if normal_len < 0.99 or normal_len > 1.01:
                    print(f"    WARNING: Non-normalized normal!")

                # Check for Z planes
                if abs(nx) < 0.001 and abs(ny) < 0.001:
                    z_val = -d / nz if nz != 0 else None
                    print(f"    Z-plane at z={z_val}")
            print()
