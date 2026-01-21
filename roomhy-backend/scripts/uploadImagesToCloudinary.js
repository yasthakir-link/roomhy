const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { uploadImage } = require('../utils/cloudinaryService');

const imagesDir = path.join(__dirname, '../../website/images');
const outputFile = path.join(__dirname, '../../imageMappings.json');

async function uploadAllImages() {
    const mappings = {};

    try {
        const files = fs.readdirSync(imagesDir);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(file));

        console.log(`Found ${imageFiles.length} images to upload`);

        for (const file of imageFiles) {
            const filePath = path.join(imagesDir, file);
            const fileBuffer = fs.readFileSync(filePath);

            console.log(`Uploading ${file}...`);

            try {
                const result = await uploadImage(fileBuffer, 'roomhy/website', file.replace(/\.[^/.]+$/, ""));
                mappings[`images/${file}`] = result.url;
                console.log(`Uploaded ${file}: ${result.url}`);
            } catch (error) {
                console.error(`Failed to upload ${file}:`, error.message);
            }
        }

        // Also upload logo files
        const logoFiles = ['logo.png', 'logo.svg'];
        for (const logoFile of logoFiles) {
            const logoPath = path.join(__dirname, '../../website', logoFile);
            if (fs.existsSync(logoPath)) {
                const fileBuffer = fs.readFileSync(logoPath);
                console.log(`Uploading ${logoFile}...`);

                try {
                    const result = await uploadImage(fileBuffer, 'roomhy/website', logoFile.replace(/\.[^/.]+$/, ""));
                    mappings[logoFile] = result.url;
                    console.log(`Uploaded ${logoFile}: ${result.url}`);
                } catch (error) {
                    console.error(`Failed to upload ${logoFile}:`, error.message);
                }
            }
        }

        fs.writeFileSync(outputFile, JSON.stringify(mappings, null, 2));
        console.log(`Image mappings saved to ${outputFile}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

uploadAllImages();