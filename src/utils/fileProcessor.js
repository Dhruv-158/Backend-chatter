const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Generate thumbnail for image
 */
const generateImageThumbnail = async (imagePath) => {
    try {
        const filename = path.basename(imagePath);
        const thumbnailPath = path.join('./uploads/thumbnails', `thumb-${filename}`);

        await sharp(imagePath)
            .resize(300, 300, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

        return `/uploads/thumbnails/thumb-${filename}`;
    } catch (error) {
        console.error('Error generating image thumbnail:', error);
        return null;
    }
};

/**
 * Compress image
 */
const compressImage = async (imagePath) => {
    try {
        const tempPath = imagePath + '.temp';
        
        await sharp(imagePath)
            .resize(1920, 1080, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 85 })
            .toFile(tempPath);

        // Replace original with compressed
        await fs.unlink(imagePath);
        await fs.rename(tempPath, imagePath);

        return true;
    } catch (error) {
        console.error('Error compressing image:', error);
        return false;
    }
};

/**
 * Generate thumbnail for video
 */
const generateVideoThumbnail = (videoPath) => {
    return new Promise((resolve, reject) => {
        const filename = path.basename(videoPath, path.extname(videoPath));
        const thumbnailPath = path.join('./uploads/thumbnails', `thumb-${filename}.jpg`);

        ffmpeg(videoPath)
            .screenshots({
                timestamps: ['00:00:01'],
                filename: `thumb-${filename}.jpg`,
                folder: './uploads/thumbnails',
                size: '300x300'
            })
            .on('end', () => {
                resolve(`/uploads/thumbnails/thumb-${filename}.jpg`);
            })
            .on('error', (err) => {
                console.error('Error generating video thumbnail:', err);
                reject(err);
            });
    });
};

/**
 * Get video duration
 */
const getVideoDuration = (videoPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error('Error getting video duration:', err);
                reject(err);
            } else {
                const duration = metadata.format.duration;
                resolve(Math.floor(duration));
            }
        });
    });
};

/**
 * Get audio duration
 */
const getAudioDuration = (audioPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err) {
                console.error('Error getting audio duration:', err);
                reject(err);
            } else {
                const duration = metadata.format.duration;
                resolve(Math.floor(duration));
            }
        });
    });
};

/**
 * Extract link metadata for preview
 */
const extractLinkMetadata = async (url) => {
    try {
        // Validate URL
        const urlObj = new URL(url);
        
        // Fetch the page
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Extract Open Graph tags
        const metadata = {
            url: url,
            title: $('meta[property="og:title"]').attr('content') || $('title').text() || '',
            description: $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="description"]').attr('content') || '',
            image: $('meta[property="og:image"]').attr('content') || 
                   $('meta[name="twitter:image"]').attr('content') || '',
            domain: urlObj.hostname
        };

        // Clean up metadata
        metadata.title = metadata.title.trim().substring(0, 200);
        metadata.description = metadata.description.trim().substring(0, 300);

        return metadata;
    } catch (error) {
        console.error('Error extracting link metadata:', error.message);
        
        // Return basic metadata if scraping fails
        try {
            const urlObj = new URL(url);
            return {
                url: url,
                title: urlObj.hostname,
                description: '',
                image: '',
                domain: urlObj.hostname
            };
        } catch {
            return null;
        }
    }
};

/**
 * Delete file from filesystem
 */
const deleteFile = async (filePath) => {
    try {
        const fullPath = path.join('.', filePath);
        await fs.unlink(fullPath);
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
};

/**
 * Get file size
 */
const getFileSize = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return stats.size;
    } catch (error) {
        console.error('Error getting file size:', error);
        return 0;
    }
};

module.exports = {
    generateImageThumbnail,
    compressImage,
    generateVideoThumbnail,
    getVideoDuration,
    getAudioDuration,
    extractLinkMetadata,
    deleteFile,
    getFileSize
};
