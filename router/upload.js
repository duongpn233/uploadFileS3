const express = require('express');
const router = express.Router();
const { upFile, saveFile, deleteFile, getListFile, getTotalSizeBucket, getSignUp, getSignDown, getAllFile, deleJunkFile, getJunkFile } = require('../controller/upload');
const uploadFile = require('../middleware/upFiles');

router.post("/up-file-s3", uploadFile.any(), upFile);
router.get("/save-file", saveFile);
router.get("/delete-file", deleteFile);
router.get("/get-listfile", getListFile);
router.get("/get-allfile", getAllFile);
router.get("/get-total-size-bucket", getTotalSizeBucket);
router.get("/sign-s3", getSignUp);
router.get("/down-sign-s3", getSignDown);
router.get("/delete-file-junk", deleJunkFile)
router.get("/get-file-junk", getJunkFile)

module.exports = router;

