function getCamera() {
  return navigator.mediaDevices.getUserMedia({video: true})
}
const virtualCanvas = document.createElement('canvas');
const ctx = virtualCanvas.getContext('2d', { willReadFrequently: true });
/**
 * 
 * @param {Ascii} list 
 * @param {number} aspect ratio largeur/hauteur de la zone affichée
 */
function compute(list, aspect) {
  const w = list.width
  const h = list.height
  if (virtualCanvas.width !== w) virtualCanvas.width = w
  if (virtualCanvas.height !== h) virtualCanvas.height = h
  // Recadrage façon "object-fit: cover" pour garder les proportions de la caméra
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  let sw = vw
  let sh = vw / aspect
  if (sh > vh) {
    sh = vh
    sw = vh * aspect
  }
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
  list.render(ctx.getImageData(0, 0, w, h).data)
}

function launch(list, getAspect) {
  // Une image par frame d'écran, et seulement quand la caméra a une nouvelle image
  let lastTime = -1
  const loop = () => {
    if (video.currentTime !== lastTime) {
      lastTime = video.currentTime
      compute(list, getAspect())
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
