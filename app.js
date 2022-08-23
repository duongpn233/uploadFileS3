require('dotenv').config();
const express = require('express');
const cros = require('cors');
const AWS = require("aws-sdk");
const Memcached = require('memcached');
const { Buffer } = require('buffer');
const { createClient } = require('redis');
const bodyParser = require('body-parser');
const uploadFile = require('./middleware/upFiles');
const { uploadPart, createMultipart, completeUpload, abortUpload } = require('./util/uploadMultipart');
const { getSizeFile, getPartFile } = require('./util/getFileMultipart');

const memcached = new Memcached("localhost:11211");

const client = createClient();
client.on('error', (err) => console.log('Redis Client Error', err));
async function connect() {
    await client.connect();
    const value = await client.get('test');
    console.log(value);
};
connect();


AWS.config.update({
    endpoint: process.env.ENDPOINT,
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
    s3ForcePathStyle: true
});

const app = express();
app.use(cros());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

app.get("/save-file", async (req, res, next) => {
    try {
        const s3 = new AWS.S3();
        const fileName = req.query["file-name"];
        let metadata = await client.hGetAll(fileName);
        let checkCache = false;
        memcached.get(fileName, (err, data) => {
            if (data) {
                const dataRes = Buffer.from(data, 'base64');
                checkCache = true;
                res.json({
                    type: "cache",
                    data: dataRes,
                    metadata: metadata
                });
            }
            else if (err) {
                next(err);
            }
        });

        if (!checkCache) {
            let sizeFile = 0;
            if (metadata) {
                sizeFile = metadata.size;
            }
            else {
                sizeFile = await getSizeFile(s3, fileName);
                console.log(sizeFile);
            }

            if (sizeFile < 20971520) {
                console.log("Get small file");
                const params = {
                    Bucket: process.env.BUCKET,
                    Key: fileName
                };
                s3.getObject(params, function (err, data) {
                    if (err) next(err);
                    else {
                        memcached.set(fileName, data.Body.toString('base64'), 600, (err) => {
                            if (err) {
                                next(err);
                            }
                        });
                        if (!metadata) {
                            metadata = {
                                size: data.ContentLength,
                                type: data.ContentType,
                                encoding: data.ContentEncoding
                            };
                            client.hSet(fileName, 'type', data.ContentType);
                            client.hSet(fileName, 'size', data.ContentLength);
                            client.hSet(fileName, 'encoding', data.ContentEncoding);
                        }
                        res.json({
                            type: "no-cache",
                            data: data.Body,
                            metadata: metadata
                        });
                    }
                });
            }
            else {
                console.log("Get big file");
                const chunkSize = Math.pow(1024, 2) * 10;
                const totalPart = Math.ceil(sizeFile / chunkSize);
                const arrPart = Array.from(Array(totalPart).keys());
                const arrBuffs = await Promise.all(
                    arrPart.map((part) => {
                        return getPartFile(s3, fileName, part * chunkSize, (part + 1) * chunkSize - 1, part + 1)
                    })
                );
                const resBuffs = arrBuffs.reduce((buff, currentBuff) => {
                    return buff.concat(currentBuff.data);
                }, []);
                const buffers = Buffer.concat(resBuffs);
                console.log("buffers", buffers)
                res.json({
                    type: "no-cache",
                    data: resBuffs,
                    metadata: metadata
                })
            }
        }
    } catch (error) {
        next(error);
    }
});

app.get("/delete-file", (req, res, next) => {
    const s3 = new AWS.S3();
    const fileName = req.query["file-name"];
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName
    };
    s3.deleteObject(params, async function (err, data) {
        try {
            if (err) next(err);
            else {
                memcached.get(fileName, (err, data) => {
                    if (err) return next(err);
                    memcached.del(fileName, (err) => {
                        if (err) return next(err);
                    });
                });
                const metadata = await client.hGetAll(fileName);
                if (metadata) {
                    for (key in metadata) {
                        client.hDel(fileName, key);
                    }
                }
                res.json("Success");
            }
        } catch (error) {
            next(error);
        }
    });
});

app.get("/get-listfile", (req, res, next) => {
    try {
        const s3 = new AWS.S3();
        const params = {
            Bucket: process.env.BUCKET,
            MaxKeys: 20
        };
        s3.listObjects(params, (err, data) => {
            if (err) return next(err);
            const listKeys = data.Contents.map((file) => {
                return file.Key;
            });
            res.json(listKeys);
        });
    } catch (error) {
        next(error);
    }
});

app.post("/up-file-s3", uploadFile.any(), async (req, res, next) => {
    try {
        const s3 = new AWS.S3();
        const resUrl = [];
        let checkCache = false;
        for (let i = 0; i < req.files.length; i++) {
            console.log(req.files[i]);
            if (req.files[i].size < 20971520) {
                console.log("Up small size")
                const params = { Bucket: process.env.BUCKET, Key: req.files[i].originalname, Body: req.files[i].buffer };
                s3.upload(params, function (err, data) {
                    console.log(data);
                    if (err) return next(err);
                    checkCache = true;
                    resUrl.push(data.Location);
                });
            }
            else {
                console.log("Up big size");
                const chunkSize = Math.pow(1024, 2) * 10;
                const sizeFile = req.files[i].size;
                const totalPart = Math.ceil(sizeFile / chunkSize);
                const arrPart = Array.from(Array(totalPart).keys());
                const uploadId = await createMultipart(s3, req.files[i].originalname);
                console.log(uploadId)
                const resParts = await Promise.allSettled(
                    arrPart.map((part) => {
                        return uploadPart(s3, req.files[i].buffer.slice(part * chunkSize, (part + 1) * chunkSize), uploadId, part + 1, req.files[i].originalname);
                    })
                );
                console.log(resParts);
                const failParts = [];
                const succeedParts = [];
                for (let i = 0; i < resParts.length; i++) {
                    if (resParts[i].status === "rejected") {
                        failParts.push(i + 1);
                    }
                    else {
                        const value = { ...resParts[i].value };
                        succeedParts.push(value);
                    }
                }
                if (failParts.length) {
                    const retriedParts = await Promise.all(
                        failParts.map((part) => {
                            return uploadPart(s3, req.files[i].buffer.slice((part - 1) * chunkSize, part * chunkSize), uploadId, part, req.files[i].originalname);
                        })
                    );
                    succeedParts.push(...retriedParts);
                }
                const dataRes = await completeUpload(s3, uploadId, succeedParts.sort((a, b) => a.PartNumber - b.PartNumber), req.files[i].originalname);
                if (!dataRes.Location) {
                    await abortUpload(s3, uploadId, req.files[i].originalname);
                }
                else {
                    checkCache = true;
                    resUrl.push(dataRes.Location);
                };
            }

            if (checkCache) {
                // memcached.set(req.files[i].originalname, req.files[i].buffer.toString('base64'), 600, (err) => {
                //     if (err) {
                //         next(err);
                //     }
                // });
                client.hSet(req.files[i].originalname, 'type', req.files[i].mimetype);
                client.hSet(req.files[i].originalname, 'size', req.files[i].size);
                client.hSet(req.files[i].originalname, 'encoding', req.files[i].encoding);
            }

            if (i === req.files.length - 1) {
                res.json(resUrl);
            }
        }
    } catch (error) {
        next(error);
    }
});


app.get("/get-total-size-bucket", (req, res, next) => {
    const s3 = new AWS.S3();
    let total = 0;
    const params = {
        Bucket: process.env.BUCKET,
        MaxKeys: 20
    };
    s3.listObjects(params, async (err, data) => {
        try {
            if (err) return next(err);
            for (let i = 0; i < data.Contents.length; i++) {
                let size = await client.hGet(data.Contents[i].Key, 'size');
                total = total + parseInt(size);
            }
            res.json(total);
        } catch (error) {
            next(error);
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
