function getCamera() {
  return navigator.mediaDevices.getUserMedia({video: true})
}
const virtualCanvas = document.createElement('canvas');
const ctx = virtualCanvas.getContext("2d");
/**
 * 
 * @param {Ascii} list 
 */
function compute(list) {
  const w = list.width
  const h = list.height
  virtualCanvas.width = w
  virtualCanvas.height = h
  // Recadrage façon "object-fit: cover" pour garder les proportions de la caméra
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  const scale = Math.max(w / vw, h / vh)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
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

async function launch(list) {
  await this.compute(list)
  await new Promise(res => setTimeout(() => res(), 50))
  await this.launch(list)
}