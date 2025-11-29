const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const { cloudinary } = require('../config/cloudinary');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Generate thumbnail for image
 * For Cloudinary: Returns a transformed URL
 */
const generateImageThumbnail = async (imagePath) => {
    try {
        // If it's a Cloudinary URL, use transformations
        if (imagePath.includes('cloudinary.com')) {
            // Insert transformation before the version/filename
            // Example: .../upload/v1234/id.jpg -> .../upload/w_300,c_limit/v1234/id.jpg
            return imagePath.replace('/upload/', '/upload/w_300,c_limit/');
        }

        // Local fallback (should not be reached in production with Cloudinary)
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
        return imagePath; // Return original if failure
    }
};

/**
 * Compress image
 * For Cloudinary: No-op (handled by upload params)
 */
const compressImage = async (imagePath) => {
    if (imagePath.includes('cloudinary.com')) {
        return true; // Already compressed by Cloudinary
    }
    
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
 * For Cloudinary: Returns a transformed URL (jpg format, 2nd second)
 */
const generateVideoThumbnail = async (videoPath) => {
    if (videoPath.includes('cloudinary.com')) {
        // Change extension to .jpg and add transformation
        // .../upload/v123/video.mp4 -> .../upload/so_2.0,w_300,c_limit,f_jpg/v123/video.jpg
        const urlWithoutExt = videoPath.substring(0, videoPath.lastIndexOf('.'));
        return urlWithoutExt.replace('/upload/', '/upload/so_2.0,w_300,c_limit,f_jpg/') + '.jpg';
    }

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
 * For Cloudinary: Uses API to fetch resource metadata
 */
const getVideoDuration = async (videoPath) => {
    if (videoPath.includes('cloudinary.com')) {
        try {
            // Extract public_id from URL
            // URL format: .../upload/v1234/folder/public_id.mp4
            const matches = videoPath.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
            if (matches && matches[1]) {
                const publicId = matches[1];
                const resource = await cloudinary.api.resource(publicId, { resource_type: 'video' });
                return Math.round(resource.duration);
            }
        } catch (error) {
            console.error('Error getting Cloudinary video duration:', error.message);
            return 0;
        }
    }

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
 * For Cloudinary: Uses API to fetch resource metadata
 */
const getAudioDuration = async (audioPath) => {
    if (audioPath.includes('cloudinary.com')) {
        try {
            // Extract public_id from URL
            const matches = audioPath.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
            if (matches && matches[1]) {
                const publicId = matches[1];
                // Audio is often treated as 'video' resource_type in Cloudinary API for duration
                const resource = await cloudinary.api.resource(publicId, { resource_type: 'video' });
                return Math.round(resource.duration);
            }
        } catch (error) {
            console.error('Error getting Cloudinary audio duration:', error.message);
            return 0;
        }
    }

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
 * Delete file from filesystem or Cloudinary
 */
const deleteFile = async (filePath) => {
    if (filePath.includes('cloudinary.com')) {
        try {
            // Extract public_id
            const matches = filePath.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
            if (matches && matches[1]) {
                const publicId = matches[1];
                // Try deleting as image, then video/raw if not found (simplified)
                await cloudinary.uploader.destroy(publicId);
                return true;
            }
        } catch (error) {
            console.error('Error deleting Cloudinary file:', error);
            return false;
        }
    }

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
    if (filePath.includes('cloudinary.com')) {
        // Size is usually not needed for logic, but if needed, would require API call
        // For now return 0 or mock, as it's mostly for display
        return 0; 
    }

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
