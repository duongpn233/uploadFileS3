require('dotenv').config();
const express = require('express');
const cros = require('cors');
const AWS = require("aws-sdk");
const fs = require('fs');
const path = require('path');
const Memcached = require('memcached');

const memcached = new Memcached("localhost:11211");

AWS.config.update({
    endpoint: process.env.ENDPOINT,
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
    s3ForcePathStyle: true
});

const app = express();
app.use(cros());

app.get("/get-bucket", (req, res, next) => {
    const s3 = new AWS.S3();
    s3.listBuckets((err, data) => {
        if (err) next(err);
        res.status(200).json(data);
    })
});

app.get("/get-location", (req, res, next) => {
    const bucket = req.query["name"];
    const s3 = new AWS.S3();
    s3.getBucketLocation({ Bucket: bucket }, (err, data) => {
        if (err) next(err);
        res.status(200).json(data);
    })
});

app.get("/delete-bucket", (req, res, next) => {
    const s3 = new AWS.S3();
    s3.listBuckets((err, data) => {
        if (err) next(err);
        if (data.Buckets.find(bucket => bucket.Name === "test-upfile")) {
            s3.deleteBucket({ Bucket: "test-upfile" }, function (err, data) {
                if (err) next(err);
                else res.status(201).json(data);
            }
            )
        }
        else {
            next(new Error({ message: "Bucket already exists" }))
        }
    })
})

app.get("/set-bucket", (req, res, next) => {
    const s3 = new AWS.S3();
    const bucket = req.query["name"];
    s3.listBuckets((err, data) => {
        if (err) next(err);
        if (!data.Buckets.find(bucket => bucket.Name === process.env.BUCKET)) {
            const params = {
                Bucket: "test-upfile",
                CreateBucketConfiguration: {
                    LocationConstraint: bucket
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
    })
})

app.get("/sign-s3", (req, res, next) => {
    const s3 = new AWS.S3();

    s3.putBucketCors(
        {
            Bucket: process.env.BUCKET,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: [
                            "*"
                        ],
                        AllowedMethods: [
                            "PUT",
                            "POST",
                            "DELETE"
                        ],
                        AllowedOrigins: [
                            "*"
                        ]
                    }
                ]
            }
        },
        err => {
            if (err) console.log(err, err.stack);
            else console.log(`Edit Bucket CORS succeed!`);
        }
    );
    let readOnlyAnonUserPolicy = {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: "*",
                Action: "*",
                Resource: [
                    ""
                ],
                ExposeHeaders: [],
            }
        ]
    };
    var bucketResource = "arn:aws:s3:::" + process.env.BUCKET + "/*";
    readOnlyAnonUserPolicy.Statement[0].Resource[0] = bucketResource;
    let bucketPolicyParams = { Bucket: process.env.BUCKET, Policy: JSON.stringify(readOnlyAnonUserPolicy) };
    s3.putBucketPolicy(bucketPolicyParams, function (err, data) {
        if (err) {
            // display error message
            console.log("Error", err);
        } else {
            console.log("Success", data);
        }
    });
    const fileName = req.query["file-name"];
    const fileType = req.query["file-type"];
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        Expires: 180,
        ContentType: fileType,
        ACL: "public-read"
    };
    s3.getSignedUrl('putObject', params, (err, data) => {
        if (err) {
            console.log(err);
            return next(err);
        }
        else {
            return res.status(200).json(data);
        }
    });
});

app.get("/down-sign-s3", (req, res, next) => {
    const s3 = new AWS.S3();
    s3.putBucketCors(
        {
            Bucket: process.env.BUCKET,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: [
                            "*"
                        ],
                        AllowedMethods: [
                            "PUT",
                            "POST",
                            "DELETE",
                            "GET"
                        ],
                        AllowedOrigins: [
                            "*"
                        ]
                    }
                ]
            }
        },
        err => {
            if (err) console.log(err, err.stack);
            else console.log(`Edit Bucket CORS succeed!`);
        }
    );

    let readOnlyAnonUserPolicy = {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: "*",
                Action: "*",
                Resource: [
                    ""
                ],
                ExposeHeaders: [],
            }
        ]
    };
    var bucketResource = "arn:aws:s3:::" + process.env.BUCKET + "/*";
    readOnlyAnonUserPolicy.Statement[0].Resource[0] = bucketResource;
    let bucketPolicyParams = { Bucket: process.env.BUCKET, Policy: JSON.stringify(readOnlyAnonUserPolicy) };
    s3.putBucketPolicy(bucketPolicyParams, function (err, data) {
        if (err) {
            // display error message
            console.log("Error", err);
        } else {
            console.log("Success", data);
        }
    });

    const fileName = req.query["file-name"];
    //const fileType = req.query["file-type"];
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        Expires: 180,
        // ContentType: fileType,
        // ACL: "public-read"
    };
    s3.getSignedUrl('getObject', params, (err, data) => {
        if (err) {
            console.log(err);
            return next(err);
        }
        else {
            return res.status(200).json(data);
        }
    });
});

app.get("/save-file", (req, res, next) => {
    const s3 = new AWS.S3();
    const fileName = req.query["file-name"];
    memcached.get(fileName, (err, data) => {
        if (data) {
            console.log("Cached");
            res.json({
                type: "cache",
                data: data
            });
        }
        else if (err) {
            next(err);
        }
        else {
            const params = {
                Bucket: process.env.BUCKET,
                Key: fileName,
            };
            s3.getObject(params, function (err, data) {
                if (err) next(err);
                else {
                    //const pathFile = path.join(__dirname, `./file/${fileName}`);
                    memcached.set(fileName, data.Body, 600, (err) => {
                        if (err) {
                            next(err);
                        }
                    });
                    //let writeStr = fs.createWriteStream(pathFile);
                    //writeStr.write(data.Body);
                    res.json({
                        type: "no-cache",
                        data: data.Body
                    });
                }
            });
        }
    });
});

app.get("/delete-file", (req, res, next) => {
    const s3 = new AWS.S3();
    const fileName = req.query["file-name"];
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName
    };
    s3.deleteObject(params, function (err, data) {
        if (err) next(err);
        else {
            memcached.get(fileName, (err, data)=>{
                if(err) return next(err);
                memcached.del(fileName, (err)=>{
                    if(err) return next(err);
                });
            });
            res.json("Success");
        }
    });
});

app.use((err, req, res) => {
    const status = err.status || 500;
    console.log(err);
    res.status(status).json({
        error: {
            message: err.message
        }
    })
});

app.listen(5000, () => {
    console.log("Sever is listening...");
});
