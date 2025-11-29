const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { storage: cloudinaryStorage } = require('../config/cloudinary');

// Check if Cloudinary is configured
const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                               process.env.CLOUDINARY_API_KEY && 
                               process.env.CLOUDINARY_API_SECRET;

let storage;

if (isCloudinaryConfigured) {
    storage = cloudinaryStorage;
} else {
    console.warn('⚠️ Cloudinary not configured. Falling back to local disk storage.');
    
    // Ensure upload directories exist
    const dirs = [
        './uploads/profiles',
        './uploads/images',
        './uploads/videos',
        './uploads/audio',
        './uploads/documents',
        './uploads/thumbnails'
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            let folder = './uploads/documents';
            if (file.mimetype.startsWith('image/')) folder = './uploads/images';
            else if (file.mimetype.startsWith('video/')) folder = './uploads/videos';
            else if (file.mimetype.startsWith('audio/')) folder = './uploads/audio';
            
            // Profile pictures go to specific folder
            if (req.originalUrl && (req.originalUrl.includes('profile') || req.url.includes('profile'))) {
                folder = './uploads/profiles';
            }

            cb(null, folder);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    });
}

// File filter to accept allowed types
const fileFilter = (req, file, cb) => {
    // Allow images, videos, audio, and common documents
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mp3|wav|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                     file.mimetype === 'application/pdf' || 
                     file.mimetype === 'application/msword' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (extname || mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type'), false);
    }
};

// Multer upload instance
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit (increased for videos)
    },
    fileFilter: fileFilter
});

module.exports = upload;