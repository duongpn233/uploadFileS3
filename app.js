require('dotenv').config();
const express = require('express');
const cros = require('cors');
const AWS = require("aws-sdk");

AWS.config.update({
    endpoint: process.env.ENDPOINT,
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
    s3ForcePathStyle: true
});

const app = express();
app.use(cros());


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
        Expires: 300,
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
    const fileType = req.query["file-type"];
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
})

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
})
