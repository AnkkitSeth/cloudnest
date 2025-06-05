const express = require('express');
const authMiddleware = require('../middlewares/authe');
const axios = require('axios');
const router = express.Router();
const multer = require('multer');
const { cloudinary, storage } = require('../config/cloudinary');
const fileModel = require('../models/files.model');

const upload = multer({ storage });

// Landing Page
router.get('/', (req, res) => {
    res.render('index'); // Renders the landing page
});

// Home Page
router.get('/home', authMiddleware, async (req, res) => {
    try {
        const userFiles = await fileModel.find({ user: req.user.userId });
        res.render('home', { files: userFiles, uploadSuccess: req.query.uploadSuccess });
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Upload Route
router.post('/upload-file', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        await fileModel.create({
            path: req.file.path,
            originalname: req.file.originalname,
            user: req.user.userId,
        });
        res.redirect('/home?uploadSuccess=true');
    } catch (error) {
        res.status(500).send('Upload failed');
    }
});

// Download Route
router.get('/download/:id', authMiddleware, async (req, res) => {
    const file = await fileModel.findOne({
        _id: req.params.id,
        user: req.user.userId,
    });

    if (!file) {
        return res.status(404).send('File not found or unauthorized');
    }

    try {
        const response = await axios({
            url: file.path,
            method: 'GET',
            responseType: 'stream',
        });

        res.setHeader('Content-Disposition', `attachment; filename="${file.originalname}"`);
        res.setHeader('Content-Type', response.headers['content-type']);

        response.data.pipe(res);
    } catch (err) {
        res.status(500).send('Failed to download file');
    }
});

// Delete Route
router.delete('/delete/:id', authMiddleware, async (req, res) => {
    try {
        const file = await fileModel.findById(req.params.id);

        if (!file) {
            return res.status(404).send('File not found');
        }

        // Checking if the file belongs to the logged-in user
        if (file.user.toString() !== req.user.userId.toString()) {
            return res.status(403).send('Unauthorized');
        }

        // Delete the file from Cloudinary
        const publicId = file.path.split('/').pop().split('.')[0]; // crude way to get public_id
        await cloudinary.uploader.destroy(publicId);

        // Delete the file document from MongoDB
        await file.deleteOne();

        res.status(200).send('File deleted successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});


module.exports = router;
