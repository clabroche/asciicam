// Rendu entièrement sur GPU : un shader lit l'image de la caméra, calcule la luminosité
// de chaque case et y dessine le glyphe braille correspondant, pris dans un atlas.
// Plus de DOM texte à mettre en page ni de boucle JS par pixel.
const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`
const FRAGMENT = `
precision mediump float;
uniform sampler2D video;
uniform sampler2D atlas;
uniform vec2 resolution;   // taille du canvas en pixels
uniform vec2 cell;         // taille d'une case en pixels
uniform vec4 crop;         // zone de la vidéo affichée (x, y, largeur, hauteur) en uv
uniform float glyphCount;  // nombre de glyphes dans l'atlas
uniform float levels[LEVELS]; // niveau de luminosité -> index du glyphe
void main() {
  vec2 frag = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  vec2 cellIndex = floor(frag / cell);
  vec2 cells = resolution / cell;
  // Moyenne de 4 échantillons dans la case, comme le faisait la réduction du canvas 2D
  vec2 base = crop.xy + crop.zw * (cellIndex / cells);
  vec2 step = crop.zw / cells;
  vec3 color = texture2D(video, base + step * vec2(0.25, 0.25)).rgb
             + texture2D(video, base + step * vec2(0.75, 0.25)).rgb
             + texture2D(video, base + step * vec2(0.25, 0.75)).rgb
             + texture2D(video, base + step * vec2(0.75, 0.75)).rgb;
  float luminance = (color.r + color.g + color.b) / 12.0;
  int level = int(min(floor(luminance * float(LEVELS)), float(LEVELS - 1)));
  float glyph = 0.0;
  for (int i = 0; i < LEVELS; i++) { if (i == level) glyph = levels[i]; }
  vec2 local = fract(frag / cell);
  float ink = texture2D(atlas, vec2((glyph + local.x) / glyphCount, local.y)).a;
  gl_FragColor = vec4(vec3(ink), 1.0);
}
`
const BLANK = '⠀'

class Ascii {
  constructor(canvas, video) {
    this.canvas = canvas
    this.video = video
    const gl = this.gl = canvas.getContext('webgl', { antialias: false, alpha: false, desynchronized: true })
    if (!gl) throw new Error('WebGL non supporté')

    // Glyphes distincts et correspondance niveau -> glyphe
    const chars = braille.map(c => c || BLANK)
    this.glyphs = [...new Set(chars)]
    const levels = chars.map(c => this.glyphs.indexOf(c))

    const program = gl.createProgram()
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT.replace(/LEVELS/g, chars.length)]]) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program)
    gl.useProgram(program)
    this.program = program

    // Un triangle qui couvre tout l'écran
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    this.uniforms = {}
    for (const name of ['video', 'atlas', 'resolution', 'cell', 'crop', 'glyphCount', 'levels']) {
      this.uniforms[name] = gl.getUniformLocation(program, name)
    }
    gl.uniform1i(this.uniforms.video, 0)
    gl.uniform1i(this.uniforms.atlas, 1)
    gl.uniform1f(this.uniforms.glyphCount, this.glyphs.length)
    gl.uniform1fv(this.uniforms.levels, levels)

    this.videoTexture = this.createTexture(0)
    this.atlasTexture = this.createTexture(1)
  }
  createTexture(unit) {
    const gl = this.gl
    const texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return texture
  }
  // size : taille de police en px CSS ; cw/ch : taille mesurée d'un glyphe en px CSS
  resize(size, cw, ch) {
    const gl = this.gl
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.round(window.innerWidth * dpr)
    this.canvas.height = Math.round(window.innerHeight * dpr)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.cell = [cw * dpr, ch * dpr]

    // Atlas : les glyphes côte à côte, dessinés à la taille réelle d'une case
    const w = Math.ceil(this.cell[0])
    const h = Math.ceil(this.cell[1])
    const atlas = document.createElement('canvas')
    atlas.width = w * this.glyphs.length
    atlas.height = h
    const actx = atlas.getContext('2d')
    actx.font = `${size * dpr}px monospace`
    actx.textBaseline = 'middle'
    actx.fillStyle = 'white'
    this.glyphs.forEach((g, i) => actx.fillText(g, i * w, h / 2))
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)

    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height)
    gl.uniform2f(this.uniforms.cell, this.cell[0], this.cell[1])
  }
  render() {
    const gl = this.gl
    const vw = this.video.videoWidth
    const vh = this.video.videoHeight
    if (!vw || !vh) return
    // Recadrage façon "object-fit: cover" pour garder les proportions de la caméra
    const aspect = this.canvas.width / this.canvas.height
    let sw = 1
    let sh = (vw / aspect) / vh
    if (sh > 1) {
      sh = 1
      sw = (vh * aspect) / vw
    }
    gl.uniform4f(this.uniforms.crop, (1 - sw) / 2, (1 - sh) / 2, sw, sh)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
