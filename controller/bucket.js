const AWS = require("aws-sdk");

const createBucket = (req, res, next) => {
    const s3 = new AWS.S3();
    const bucket = req.query["name"];
    s3.listBuckets((err, data) => {
        if (err) next(err);
        if (!data.Buckets.find(bucket => bucket.Name === process.env.BUCKET)) {
            const params = {
                Bucket: process.env.BUCKET,
                CreateBucketConfiguration: {
                    LocationConstraint: "traffic-dev-171"
                }
            };
            s3.createBucket(params, function (err, data) {
                if (err) next(err);
                else res.status(201).json(data);
            }
            )
        }
        else {
            next(new Error({ message: "Bucket already exists" }))
        }
    });
};

const deleteBucket = (req, res, next) => {
    const s3 = new AWS.S3();
    s3.listBuckets((err, data) => {
        if (err) next(err);
        if (data.Buckets.find(bucket => bucket.Name === "test-upload-file")) {
            s3.deleteBucket({ Bucket: "test-upload-file" }, function (err, data) {
                if (err) next(err);
                else res.status(201).json(data);
            }
            )
        }
        else {
            next(new Error({ message: "Bucket already exists" }))
        }
    });
};

const getBuckets = (req, res, next) => {
    const s3 = new AWS.S3();
    s3.listBuckets((err, data) => {
        if (err) next(err);
        res.status(200).json(data);
    });
};

const getLocation = (req, res, next) => {
    const bucket = req.query["name"];
    const s3 = new AWS.S3();
    s3.getBucketLocation({ Bucket: bucket }, (err, data) => {
        if (err) next(err);
        res.status(200).json(data);
    });
};

const setVersioning = (req, res, next) => {
    const s3 = new AWS.S3();
    const params = {
        Bucket: process.env.BUCKET,
        VersioningConfiguration: {
            // MFADelete: "Disabled",
            Status: "Enabled"
        },
        // ChecksumAlgorithm: "CRC32"
    };
    s3.putBucketVersioning(params, function (err, data) {
        if (err) next(err);
        else res.json(data);
    });
};

const getVersioning = (req, res, next) => {
    const bucket = req.query["bucket"];
    const s3 = new AWS.S3();
    const params = {
        Bucket: bucket,
    };
    s3.getBucketVersioning(params, function (err, data) {
        if (err) next(err);
        else res.json(data);
    });
};

const listVersion = (req, res, next) => {
    const s3 = new AWS.S3();
    const fileName = req.query["file-name"];
    const params = {
        Bucket: process.env.BUCKET,
        Prefix: fileName
    };
    s3.listObjectVersions(params, function (err, data) {
        if (err) next(err);
        else res.json(data);
    });
};

module.exports = { createBucket, deleteBucket, getBuckets, getLocation, setVersioning, getVersioning, listVersion };