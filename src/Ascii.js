class Ascii {
  constructor(width, height) {
    this.width = Math.floor(width)
    this.height = Math.floor(height)
    this.createBlock()
  }
  createBlock() {
    const width = this.width
    const height = this.height
    const asciiDiv = document.getElementById('ascii')
    asciiDiv.innerHTML = ""
    this.list = Array(height).fill('').map((_, y) => {
      const divLine = document.createElement('div')
      divLine.classList.add('line')
      asciiDiv.appendChild(divLine)
      return Array(width).fill('').map((_, x) => {
        const divChar = document.createElement('div')
        divChar.classList.add('char')
        divChar.innerText = ''
        divLine.appendChild(divChar)
        return new Char(x, y, divChar)
      })
    })
  }
  update(x, y, color) {
    const char = this.list[y][x]
    if (char.oldColor !== color) {
      char.update(color)
    }
  }
  changeSize(width, height) {
    this.width = Math.floor(width)
    this.height = Math.floor(height)
    this.createBlock()
  }
}