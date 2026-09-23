// Une ligne de texte par rangée au lieu d'une <div> par caractère :
// le DOM reste à quelques centaines de nœuds, quelle que soit la taille des caractères.
const BLANK = '⠀' // braille vide : même largeur que les autres glyphes, contrairement à ''

class Ascii {
  constructor(width, height) {
    // Table de correspondance luminosité (0-255) -> caractère, calculée une fois
    this.lut = Array.from({ length: 256 }, (_, v) => {
      const index = Math.min(Math.floor((v * braille.length) / 255), braille.length - 1)
      return braille[index] || BLANK
    })
    this.changeSize(width, height)
  }
  changeSize(width, height) {
    this.width = Math.floor(width)
    this.height = Math.floor(height)
    const asciiDiv = document.getElementById('ascii')
    asciiDiv.textContent = ''
    this.lines = Array.from({ length: this.height }, () => {
      const divLine = document.createElement('div')
      const text = document.createTextNode('')
      divLine.appendChild(text)
      asciiDiv.appendChild(divLine)
      return text
    })
    this.row = new Array(this.width)
  }
  render(data) {
    const { width, height, lut, row } = this
    for (let y = 0; y < height; y++) {
      let n = y * width * 4
      for (let x = 0; x < width; x++, n += 4) {
        row[x] = lut[((data[n] + data[n + 1] + data[n + 2]) / 3) | 0]
      }
      const line = row.join('')
      // On ne touche au DOM que si la ligne a changé
      if (this.lines[y].data !== line) this.lines[y].data = line
    }
  }
}
