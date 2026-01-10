import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = 'f:\\project\\public';
const logoPath = path.join(publicDir, '6f0fdaf5-e38a-48ad-a23e-ad6a39dd0b9f_removalai_preview.png');
const outputPath = path.join(publicDir, 'logo.webp');

async function optimizeAssets() {
    try {
        // Logo
        await sharp(logoPath)
            .resize(128, 128)
            .webp({ quality: 80 })
            .toFile(outputPath);
        console.log('Logo optimized successfully!');

        // Favicon
        const faviconPath = path.join(publicDir, 'favicon.png');
        if (fs.existsSync(faviconPath)) {
            await sharp(faviconPath)
                .resize(32, 32)
                .png({ compressionLevel: 9 })
                .toFile(path.join(publicDir, 'favicon-small.png'));
            console.log('Favicon optimized!');
        }

        // OG Image
        const ogPath = path.join(publicDir, 'og-image.png');
        if (fs.existsSync(ogPath)) {
            await sharp(ogPath)
                .resize(1200, 630)
                .jpeg({ quality: 70 })
                .toFile(path.join(publicDir, 'og-image-small.jpg'));
            console.log('OG Image optimized!');
        }
    } catch (err) {
        console.error('Error optimizing assets:', err);
    }
}

optimizeAssets();
