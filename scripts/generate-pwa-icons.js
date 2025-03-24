const fs = require('fs');
const path = require('path');

// Create directory if it doesn't exist
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Define icon sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG template for a simple placeholder icon
const createSVG = (size, color = '#6366f1') => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="${color}"/>
  <text x="${size/2}" y="${size/2 + size/20}" font-family="Arial" font-size="${size/6}" fill="white" text-anchor="middle" dominant-baseline="middle">S</text>
</svg>
`;

// Generate SVG files for each size
sizes.forEach(size => {
  const svg = createSVG(size);
  const filePath = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`Created ${filePath}`);
});

// Warning message
console.log('\nNOTE: These are placeholder SVG icons for testing purposes.');
console.log('For production, please convert these to PNG format or use actual icons.');
console.log('You can use tools like ImageMagick or online converters for this purpose.'); 