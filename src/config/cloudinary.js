const cloudinary = require('cloudinary').v2;
const CloudinaryStorage = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Determine resource type based on mimetype
        let resource_type = 'auto';
        let folder = 'chattr-uploads';
        
        if (file.mimetype.startsWith('image/')) {
            resource_type = 'image';
            folder = 'chattr-uploads/images';
        } else if (file.mimetype.startsWith('video/')) {
            resource_type = 'video';
            folder = 'chattr-uploads/videos';
        } else if (file.mimetype.startsWith('audio/')) {
            resource_type = 'video'; // Cloudinary treats audio as video resource_type often, or 'raw'/'auto'
            folder = 'chattr-uploads/audio';
        } else {
            resource_type = 'raw';
            folder = 'chattr-uploads/documents';
        }

        return {
            folder: folder,
            resource_type: resource_type,
            public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname.split('.')[0]}`,
        };
    },
});

module.exports = { cloudinary, storage };
