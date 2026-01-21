const fs = require('fs');
const path = require('path');

const mappingsPath = path.join(__dirname, '../../imageMappings.json');
const websiteDir = path.join(__dirname, '../../website');

const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));

function updateFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    for (const [localPath, cloudinaryUrl] of Object.entries(mappings)) {
        const regex = new RegExp(localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        if (regex.test(content)) {
            content = content.replace(regex, cloudinaryUrl);
            updated = true;
        }
    }

    if (updated) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (file.endsWith('.html')) {
            updateFile(filePath);
        }
    }
}

walkDir(websiteDir);
console.log('Image source updates completed.');