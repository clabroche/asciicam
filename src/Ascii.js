// Rendu entièrement sur GPU : un shader lit l'image de la caméra, calcule la luminosité
// de chaque case et y dessine le caractère correspondant, pris dans un atlas.
// Plus de DOM texte à mettre en page ni de boucle JS par pixel.
const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`
const FRAGMENT = `
// highp : en mediump, la position des pixels perd en précision au-delà de ~1000 px
// et les bords de cases tombent sur le mauvais glyphe (lignes sombres)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D video;
uniform sampler2D atlas;
uniform vec2 resolution;   // taille du canvas en pixels
uniform vec2 cell;         // taille d'une case en pixels
uniform vec4 crop;         // zone de la vidéo affichée (x, y, largeur, hauteur) en uv
uniform float levels;      // nombre de niveaux = nombre de glyphes dans l'atlas
uniform float mirror;      // 1 : image retournée horizontalement
uniform float invert;      // 1 : caractères denses sur les zones sombres
uniform float colorMode;   // 0 : couleur fixe (tint), 1 : couleur de la caméra
uniform vec3 tint;
uniform float crt;         // 1 : effet écran cathodique
uniform float dpr;

vec2 cellIndex;
vec2 cells;
vec2 videoUv(vec2 q) {
  vec2 p = (cellIndex + q) / cells;
  p.x = mix(p.x, 1.0 - p.x, mirror);
  return crop.xy + crop.zw * p;
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y) / resolution;
  if (crt > 0.5) {
    // Léger bombement de l'écran
    vec2 c = uv * 2.0 - 1.0;
    c *= 1.0 + 0.035 * dot(c, c);
    uv = c * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
  }
  vec2 frag = uv * resolution;
  cellIndex = floor(frag / cell);
  cells = resolution / cell;
  // Moyenne de 4 échantillons dans la case
  vec3 color = (texture2D(video, videoUv(vec2(0.25, 0.25))).rgb
              + texture2D(video, videoUv(vec2(0.75, 0.25))).rgb
              + texture2D(video, videoUv(vec2(0.25, 0.75))).rgb
              + texture2D(video, videoUv(vec2(0.75, 0.75))).rgb) / 4.0;
  // Densité du glyphe : luminance perçue en monochrome ; en mode caméra, intensité de la
  // couleur (max des canaux), sinon un rouge pur ne serait qu'à 30 % et paraîtrait sombre
  float peak = max(max(color.r, color.g), color.b);
  float luminance = mix(dot(color, vec3(0.299, 0.587, 0.114)), peak, colorMode);
  luminance = mix(luminance, 1.0 - luminance, invert);
  // L'atlas contient un glyphe par niveau, dans l'ordre : l'index du glyphe est le niveau
  float glyph = min(floor(luminance * levels), levels - 1.0);
  vec2 local = fract(frag / cell);
  float ink = texture2D(atlas, vec2((glyph + local.x) / levels, local.y)).a;

  // En mode caméra, la teinte vient de l'image et la luminosité du glyphe
  vec3 fg = mix(tint, color / max(peak, 0.001), colorMode);
  vec3 outColor = fg * ink;

  if (crt > 0.5) {
    float scan = 0.8 + 0.2 * sin(frag.y * 3.14159 / (1.5 * dpr));
    vec2 v = uv * (1.0 - uv);
    float vignette = pow(v.x * v.y * 16.0, 0.25);
    outColor = outColor * scan * vignette * 1.15;
  }
  gl_FragColor = vec4(outColor, 1.0);
}
`

// Caractères de blocs dessinés comme des aplats : les polices les rendent souvent avec des trous
const BLOCK_ALPHA = { '█': 1, '▓': 0.75, '▒': 0.5, '░': 0.25 }

class Ascii {
  constructor(canvas, video) {
    this.canvas = canvas
    this.video = video
    const gl = this.gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      desynchronized: true,
      // Garde le dernier rendu lisible : sans ça, un contexte désynchronisé peut
      // renvoyer une image noire à la capture sur certains GPU
      preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL non supporté')

    const program = gl.createProgram()
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
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
    for (const name of ['video', 'atlas', 'resolution', 'cell', 'crop', 'levels', 'mirror', 'invert', 'colorMode', 'tint', 'crt', 'dpr']) {
      this.uniforms[name] = gl.getUniformLocation(program, name)
    }
    gl.uniform1i(this.uniforms.video, 0)
    gl.uniform1i(this.uniforms.atlas, 1)

    this.setOptions({ mirror: false, invert: false, colorMode: 'mono', tint: [1, 1, 1], crt: false })

    this.videoTexture = this.createTexture(0)
    this.atlasTexture = this.createTexture(1)
    // L'atlas est généré à la taille exacte d'une case : pas de lissage, sinon les bords
    // de chaque glyphe se mélangent avec le voisin et font apparaître des lignes
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
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
  // chars : un caractère par niveau de luminosité, du plus sombre au plus clair
  // size : taille de police en px CSS ; cw/ch : taille mesurée d'un glyphe en px CSS
  resize(chars, size, cw, ch) {
    const gl = this.gl
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.round(window.innerWidth * dpr)
    this.canvas.height = Math.round(window.innerHeight * dpr)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.cell = [cw * dpr, ch * dpr]

    // Atlas : un glyphe par niveau, côte à côte, dessinés à la taille réelle d'une case
    const w = Math.ceil(this.cell[0])
    const h = Math.ceil(this.cell[1])
    const atlas = document.createElement('canvas')
    atlas.width = w * chars.length
    atlas.height = h
    const actx = atlas.getContext('2d')
    actx.font = `${size * dpr}px monospace`
    actx.textBaseline = 'middle'
    actx.fillStyle = 'white'
    actx.textAlign = 'center'
    chars.forEach((c, i) => {
      if (c in BLOCK_ALPHA) {
        actx.globalAlpha = BLOCK_ALPHA[c]
        actx.fillRect(i * w, 0, w, h)
        actx.globalAlpha = 1
      } else {
        actx.fillText(c, i * w + w / 2, h / 2)
      }
    })
    this.chars = chars
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)

    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height)
    gl.uniform2f(this.uniforms.cell, this.cell[0], this.cell[1])
    gl.uniform1f(this.uniforms.levels, chars.length)
    gl.uniform1f(this.uniforms.dpr, dpr)
  }
  // options : { mirror, invert, colorMode: 'mono' | 'camera', tint: [r, g, b] (0-1), crt }
  setOptions(options) {
    const gl = this.gl
    this.options = { ...this.options, ...options }
    const o = this.options
    gl.uniform1f(this.uniforms.mirror, o.mirror ? 1 : 0)
    gl.uniform1f(this.uniforms.invert, o.invert ? 1 : 0)
    gl.uniform1f(this.uniforms.colorMode, o.colorMode === 'camera' ? 1 : 0)
    gl.uniform3fv(this.uniforms.tint, o.tint)
    gl.uniform1f(this.uniforms.crt, o.crt ? 1 : 0)
  }
  // Image PNG du rendu actuel
  snapshot() {
    this.render()
    return new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'))
  }
  // Le rendu actuel en texte brut, calculé sur le CPU à partir de l'image de la caméra
  toText() {
    const cols = Math.ceil(this.canvas.width / this.cell[0])
    const rows = Math.ceil(this.canvas.height / this.cell[1])
    const { crop } = this.cropRect()
    const vw = this.video.videoWidth
    const vh = this.video.videoHeight
    const c = document.createElement('canvas')
    c.width = cols
    c.height = rows
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (this.options.mirror) {
      ctx.translate(cols, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(this.video, crop[0] * vw, crop[1] * vh, crop[2] * vw, crop[3] * vh, 0, 0, cols, rows)
    const data = ctx.getImageData(0, 0, cols, rows).data
    const n = this.chars.length
    const blank = this.chars[0] || ' '
    let text = ''
    for (let y = 0; y < rows; y++) {
      let line = ''
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4
        let l = this.options.colorMode === 'camera'
          ? Math.max(data[i], data[i + 1], data[i + 2]) / 255
          : (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
        if (this.options.invert) l = 1 - l
        line += this.chars[Math.min(Math.floor(l * n), n - 1)] || blank
      }
      text += line.trimEnd() + '\n'
    }
    return text
  }
  // Recadrage façon "object-fit: cover" pour garder les proportions de la caméra
  cropRect() {
    const vw = this.video.videoWidth
    const vh = this.video.videoHeight
    const aspect = this.canvas.width / this.canvas.height
    let sw = 1
    let sh = (vw / aspect) / vh
    if (sh > 1) {
      sh = 1
      sw = (vh * aspect) / vw
    }
    return { crop: [(1 - sw) / 2, (1 - sh) / 2, sw, sh] }
  }
  render() {
    const gl = this.gl
    const vw = this.video.videoWidth
    const vh = this.video.videoHeight
    if (!vw || !vh) return
    gl.uniform4f(this.uniforms.crop, ...this.cropRect().crop)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
