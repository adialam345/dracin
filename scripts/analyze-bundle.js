#!/usr/bin/env node

/**
 * Bundle Size Analyzer
 * Checks the size of built assets and provides optimization recommendations
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const DIST_DIR = './dist';
const SIZE_LIMITS = {
    js: 250 * 1024,      // 250KB for JS files
    css: 50 * 1024,      // 50KB for CSS files
    total: 1024 * 1024   // 1MB total
};

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function getFileSize(filePath) {
    const stats = await stat(filePath);
    return stats.size;
}

async function analyzeDirectory(dir, results = { js: 0, css: 0, other: 0, files: [] }) {
    try {
        const files = await readdir(dir);

        for (const file of files) {
            const filePath = join(dir, file);
            const stats = await stat(filePath);

            if (stats.isDirectory()) {
                await analyzeDirectory(filePath, results);
            } else {
                const size = stats.size;
                const ext = file.split('.').pop();

                results.files.push({ name: file, size, path: filePath });

                if (ext === 'js' || ext === 'mjs') {
                    results.js += size;
                } else if (ext === 'css') {
                    results.css += size;
                } else {
                    results.other += size;
                }
            }
        }
    } catch (error) {
        console.error(`Error analyzing directory ${dir}:`, error.message);
    }

    return results;
}

async function main() {
    console.log('🔍 Analyzing bundle size...\n');

    const results = await analyzeDirectory(join(DIST_DIR, '_astro'));
    const totalSize = results.js + results.css + results.other;

    console.log('📦 Bundle Analysis:');
    console.log('─'.repeat(50));
    console.log(`JavaScript:  ${formatBytes(results.js)}`);
    console.log(`CSS:         ${formatBytes(results.css)}`);
    console.log(`Other:       ${formatBytes(results.other)}`);
    console.log('─'.repeat(50));
    console.log(`Total:       ${formatBytes(totalSize)}\n`);

    // Show largest files
    console.log('📊 Largest Files:');
    console.log('─'.repeat(50));
    const sortedFiles = results.files.sort((a, b) => b.size - a.size).slice(0, 10);
    sortedFiles.forEach((file, i) => {
        console.log(`${i + 1}. ${file.name.padEnd(30)} ${formatBytes(file.size)}`);
    });
    console.log('');

    // Check against limits
    console.log('⚠️  Size Warnings:');
    console.log('─'.repeat(50));
    let hasWarnings = false;

    if (results.js > SIZE_LIMITS.js) {
        console.log(`❌ JavaScript bundle exceeds limit: ${formatBytes(results.js)} > ${formatBytes(SIZE_LIMITS.js)}`);
        hasWarnings = true;
    } else {
        console.log(`✅ JavaScript bundle within limit: ${formatBytes(results.js)}`);
    }

    if (results.css > SIZE_LIMITS.css) {
        console.log(`❌ CSS bundle exceeds limit: ${formatBytes(results.css)} > ${formatBytes(SIZE_LIMITS.css)}`);
        hasWarnings = true;
    } else {
        console.log(`✅ CSS bundle within limit: ${formatBytes(results.css)}`);
    }

    if (totalSize > SIZE_LIMITS.total) {
        console.log(`❌ Total bundle exceeds limit: ${formatBytes(totalSize)} > ${formatBytes(SIZE_LIMITS.total)}`);
        hasWarnings = true;
    } else {
        console.log(`✅ Total bundle within limit: ${formatBytes(totalSize)}`);
    }

    if (!hasWarnings) {
        console.log('\n✨ All bundles are within acceptable limits!');
    } else {
        console.log('\n💡 Consider further optimization or code splitting.');
    }

    console.log('');
}

main().catch(console.error);
