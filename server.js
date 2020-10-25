const express = require('express')
const app = express()
const port = process.env.PORT || 2525
const path = require('path')
app.use(express.static(path.resolve(__dirname, 'src')))
app.use((req, res) => {
  res.redirect('/index.html')
})

app.listen(port, () => {
  console.log(`AsciiCam listening at http://localhost:${port}`)
})