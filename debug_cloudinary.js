const pkg = require('multer-storage-cloudinary');
console.log('Type:', typeof pkg);
console.log('Is Class/Function:', typeof pkg === 'function');
console.log('Keys:', Object.keys(pkg));
if (pkg.CloudinaryStorage) {
    console.log('Has CloudinaryStorage property');
} else {
    console.log('No CloudinaryStorage property');
}
