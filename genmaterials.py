with open("genmaterials_materials.txt", 'r') as _in, open("doom2.mtl", 'w') as _out:
    for line in _in:
        texture = line.rstrip('\n')

        _out.write(f'''textures/doom2/{texture} {{
    qer_editorimage textures/doom2/{texture}
    diffusemap textures/doom2/{texture}
}}
''')