function getCamera() {
  return navigator.mediaDevices.getUserMedia({video: true})
}

/**
 * @param {Ascii} ascii
 */
function launch(ascii) {
  // Une image par frame d'écran, et seulement quand la caméra a une nouvelle image
  let lastTime = -1
  const loop = () => {
    if (video.currentTime !== lastTime) {
      lastTime = video.currentTime
      ascii.render()
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
