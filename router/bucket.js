const express = require('express');
const router = express.Router();
const { createBucket, deleteBucket, getBuckets, getLocation, setVersioning, getVersioning, listVersion } = require('../controller/bucket');

router.get("/get-buckets", getBuckets);
router.get("/create-bucket", createBucket);
router.get("/delete-bucket", deleteBucket);
router.get("/get-location", getLocation);
router.get("/set-versioning", setVersioning);
router.get("/get-versioning", getVersioning);
router.get("/list-version", listVersion);

module.exports = router;