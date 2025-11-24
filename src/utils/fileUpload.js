const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = [
    './uploads/images',
    './uploads/videos',
    './uploads/documents',
    './uploads/audio',
    './uploads/thumbnails'
];

uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// File filter for images
const imageFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WEBP, and SVG images are allowed.'), false);
    }
};

// File filter for videos
const videoFilter = (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only MP4, MPEG, MOV, AVI, and WEBM videos are allowed.'), false);
    }
};

// File filter for documents
const documentFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, XLS, and XLSX are allowed.'), false);
    }
};

// File filter for audio
const audioFilter = (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only MP3, WAV, OGG, and WEBM audio files are allowed.'), false);
    }
};

// Generate unique filename
const generateFilename = (originalname) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(originalname);
    return `${timestamp}-${randomString}${ext}`;
};

// Storage configuration for images
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/images');
    },
    filename: (req, file, cb) => {
        cb(null, 'img-' + generateFilename(file.originalname));
    }
});

// Storage configuration for videos
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/videos');
    },
    filename: (req, file, cb) => {
        cb(null, 'vid-' + generateFilename(file.originalname));
    }
});

// Storage configuration for documents
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/documents');
    },
    filename: (req, file, cb) => {
        cb(null, 'doc-' + generateFilename(file.originalname));
    }
});

// Storage configuration for audio
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/audio');
    },
    filename: (req, file, cb) => {
        cb(null, 'aud-' + generateFilename(file.originalname));
    }
});

// Multer upload configurations
const uploadImage = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

const uploadVideo = multer({
    storage: videoStorage,
    fileFilter: videoFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

const uploadDocument = multer({
    storage: documentStorage,
    fileFilter: documentFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

const uploadAudio = multer({
    storage: audioStorage,
    fileFilter: audioFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

module.exports = {
    uploadImage,
    uploadVideo,
    uploadDocument,
    uploadAudio
};
