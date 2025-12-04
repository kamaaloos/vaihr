const sharp = require('sharp');
const fs = require('fs');

const svgBuffer = fs.readFileSync('./assets/icon.svg');

sharp(svgBuffer)
  .resize(1024, 1024)
  .png()
  .toFile('./assets/adaptive-icon.png')
  .then(() => console.log('Conversion complete'))
  .catch(err => console.error('Error converting:', err)); 