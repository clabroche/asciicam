function getCamera() {
  return navigator.mediaDevices.getUserMedia({video: true})
}

/**
 * 
 * @param {Ascii} list 
 */
function compute(list) {
  const w = list.width
  const h = list.height
  const virtualCanvas = document.createElement('canvas');
  const ctx = virtualCanvas.getContext("2d");
  virtualCanvas.width = w
  virtualCanvas.height = h
  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  var data = imageData.data;
  for (let y = 0; y < h; y++) {
    for(let x = 0; x<w; x++) {
      var n = 4 * (w * y + x);
      var r = data[n];
      var g = data[n + 1];
      var b = data[n + 2];
      const average = (r + g + b) / 3
      list.update(x, y, average)
    }
  }
  // this.$refs.canvas.getContext('2d').putImageData(imageData, 0, 0);
}

async function launch( list) {
  await this.compute(list)
  await new Promise(res => setTimeout(() => res(), 50))
  await this.launch(list)
}