const fs = require('fs');
const path = require('path');

// Comprehensive unicode replacement map
const replacements = {
    'â‚¹': '₹',           // Rupee symbol
    'ðŸ‹': '👋',       // Waving hand
    'ðŸ¡': '💡',       // Light bulb
    'ðŸ„': '📄',       // Document
    'ðŸ—ï¸': '📋',     // Clipboard
    'â˜…': '★',         // Filled star
    'â˜†': '☆',        // Empty star
    'â€"': '–',         // En dash
    'â€™': "'",         // Right single quote
    'â€œ': '"',         // Left double quote
    'â€': '"',         // Right double quote
    'âœ…': '✅',        // Check mark
    'âœ"': '✔',        // Check
    'âœ•': '✕',        // X mark
    'âœ—': '✗',        // Heavy X
    'âŒ': '❌',         // Cross mark
    'â†': '→',        // Right arrow
    'â†—': '↑',        // Up arrow
    'â†': '↓',       // Down arrow
    'â„¹ï¸': 'ℹ️',      // Info
    'âš ': '⚠',        // Warning
    'âš ï¸': '⚠️',    // Warning emoji
    'â—': '●',         // Bullet
    'â€¢': '•',        // Bullet point
    'âž–': '➖',        // Minus
    'ðŸŽ': '👎',       // Thumbs down
    'ðŸ‰': '👉',       // Pointing
    'ðŸŌ': '🌶',       // Fire/Chili
    'ðŸŽ‰': '🎉',       // Party popper
};

function fixUnicodeInFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let original = content;
        let changed = false;

        for (const [corrupt, correct] of Object.entries(replacements)) {
            if (content.includes(corrupt)) {
                original = original.replace(new RegExp(corrupt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
                changed = true;
            }
        }

        if (changed) {
            fs.writeFileSync(filePath, original, 'utf8');
            console.log(`Fixed: ${filePath}`);
            return true;
        }
    } catch (e) {
        console.error(`Error with ${filePath}: ${e.message}`);
    }
    return false;
}

function walkDirectory(dir) {
    let fixedCount = 0;
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            fixedCount += walkDirectory(filePath);
        } else if (file.endsWith('.html')) {
            if (fixUnicodeInFile(filePath)) {
                fixedCount++;
            }
        }
    }

    return fixedCount;
}

const rootDir = '.';
const fixedCount = walkDirectory(rootDir);
console.log(`\nTotal files fixed: ${fixedCount}`);