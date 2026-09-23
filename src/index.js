function getCamera() {
  // Plus d'images par seconde = moins d'attente entre deux images de la caméra
  return navigator.mediaDevices.getUserMedia({
    video: { frameRate: { ideal: 60 } },
  })
}

/**
 * @param {Ascii} ascii
 */
function launch(ascii) {
  // Rendu dès qu'une image de la caméra est prête, sans attendre la prochaine frame d'écran
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    const onFrame = () => {
      ascii.render()
      video.requestVideoFrameCallback(onFrame)
    }
    video.requestVideoFrameCallback(onFrame)
    return
  }
  // Repli : une image par frame d'écran, seulement quand la caméra a une nouvelle image
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
