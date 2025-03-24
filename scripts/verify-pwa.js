const fs = require('fs');
const path = require('path');
const chalk = require('chalk') || { green: (text) => text, red: (text) => text, yellow: (text) => text };

console.log(chalk.green('\n📱 PWA Setup Verification\n'));

// Check manifest.json
const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
if (fs.existsSync(manifestPath)) {
  console.log(chalk.green('✅ manifest.json found'));
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Check required fields
    const requiredFields = ['name', 'short_name', 'icons', 'start_url', 'display'];
    const missingFields = requiredFields.filter(field => !manifest[field]);
    
    if (missingFields.length === 0) {
      console.log(chalk.green('✅ manifest.json contains all required fields'));
    } else {
      console.log(chalk.red(`❌ manifest.json is missing required fields: ${missingFields.join(', ')}`));
    }
    
    // Check icons
    if (manifest.icons && Array.isArray(manifest.icons)) {
      console.log(chalk.green(`✅ manifest.json defines ${manifest.icons.length} icons`));
      
      // Check if icons exist
      const missingIcons = manifest.icons.filter(icon => {
        const iconPath = path.join(process.cwd(), 'public', icon.src.replace(/^\//, ''));
        return !fs.existsSync(iconPath);
      });
      
      if (missingIcons.length === 0) {
        console.log(chalk.green('✅ All icon files exist'));
      } else {
        console.log(chalk.red(`❌ ${missingIcons.length} icon files are missing: ${missingIcons.map(icon => icon.src).join(', ')}`));
      }
    } else {
      console.log(chalk.red('❌ manifest.json does not contain an array of icons'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error parsing manifest.json: ${error.message}`));
  }
} else {
  console.log(chalk.red('❌ manifest.json not found in /public directory'));
}

// Check offline.html
const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
if (fs.existsSync(offlinePath)) {
  console.log(chalk.green('✅ offline.html found'));
} else {
  console.log(chalk.yellow('⚠️ offline.html not found. This is recommended for offline experience.'));
}

// Check next-pwa dependency
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  if (packageJson.dependencies && packageJson.dependencies['next-pwa']) {
    console.log(chalk.green('✅ next-pwa dependency found'));
  } else {
    console.log(chalk.red('❌ next-pwa dependency not found in package.json'));
  }
} catch (error) {
  console.log(chalk.red(`❌ Error checking next-pwa dependency: ${error.message}`));
}

// Check next.config.js or next.config.mjs
const nextConfigPath = fs.existsSync(path.join(process.cwd(), 'next.config.js')) 
  ? path.join(process.cwd(), 'next.config.js')
  : path.join(process.cwd(), 'next.config.mjs');

if (fs.existsSync(nextConfigPath)) {
  const configContent = fs.readFileSync(nextConfigPath, 'utf8');
  if (configContent.includes('next-pwa') || configContent.includes('withPWA')) {
    console.log(chalk.green('✅ PWA configuration found in Next.js config'));
  } else {
    console.log(chalk.red('❌ PWA configuration not found in Next.js config'));
  }
} else {
  console.log(chalk.red('❌ Next.js config file not found'));
}

console.log(chalk.green('\n🚀 PWA verification complete\n'));
console.log(chalk.yellow('Note: For a complete PWA experience, make sure to:'));
console.log(chalk.yellow('  - Test your app in Chrome DevTools (Application tab)'));
console.log(chalk.yellow('  - Verify Lighthouse PWA score'));
console.log(chalk.yellow('  - Test installation on actual devices\n')); 