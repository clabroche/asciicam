
class Char {
  constructor(x, y, div) {
    this.x = x
    this.y = y
    this.char = ''
    this.div = div
    this.oldColor = 0
    this.oldChar = ''
  }
  update(color) {
    const collection = braille
    const index = (color * collection.length) / 255
    const char = collection[Math.floor(index)]
    this.oldColor = color
    if (char !== this.oldChar) {
      this.oldChar = char
      this.div.textContent = char
    }
  }
}