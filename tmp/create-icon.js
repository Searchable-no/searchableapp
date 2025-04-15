const fs = require('fs');
const { createCanvas } = require('canvas');

// Opprett en 192x192 ikon
const canvas = createCanvas(192, 192);
const ctx = canvas.getContext('2d');

// Sett bakgrunnsfarge
ctx.fillStyle = '#2563eb';  // Blå bakgrunn
ctx.fillRect(0, 0, 192, 192);

// Tegn en "S" for Searchable
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 120px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('S', 96, 96);

// Lagre som PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('public/icon-192x192.png', buffer);

console.log('Ikon generert: public/icon-192x192.png');

// Opprett en 512x512 ikon også
const largeCanvas = createCanvas(512, 512);
const largeCtx = largeCanvas.getContext('2d');

// Sett bakgrunnsfarge
largeCtx.fillStyle = '#2563eb';  // Blå bakgrunn
largeCtx.fillRect(0, 0, 512, 512);

// Tegn en "S" for Searchable
largeCtx.fillStyle = '#ffffff';
largeCtx.font = 'bold 320px Arial';
largeCtx.textAlign = 'center';
largeCtx.textBaseline = 'middle';
largeCtx.fillText('S', 256, 256);

// Lagre som PNG
const largeBuffer = largeCanvas.toBuffer('image/png');
fs.writeFileSync('public/icon-512x512.png', largeBuffer);

console.log('Ikon generert: public/icon-512x512.png'); 