// const AWS = require("aws-sdk");
const { Buffer } = require('buffer');
const { memcached, getData } = require('../util/memcached');
const { client } = require('../util/connectRedis');
const { getSizeFile, getPartFile } = require('../util/getFileMultipart');
const { createMultipart, uploadPart, completeUpload, abortUpload, upload } = require('../util/uploadMultipart');
const { AWS } = require('../util/configS3');
const { connect } = require('../util/connectDb');

const saveFile = async (req, res, next) => {
    try {
        if (req.session.user) {
            const s3 = new AWS.S3();
            const fileName = req.query["file-name"];
            const metadataJson = await client.get(`${req.session.user.idUser}`);
            const metadatas = JSON.parse(metadataJson);
            let metadata = {};
            if (metadatas) {
                const metadataCheck = metadatas.find((metadata) => metadata.name === fileName);
                if (metadataCheck) {
                    metadata = { ...metadataCheck };
                }
            }
            let arrData = [];
            let checkCache = false;
            const dataCache = await getData(`${req.session.user.idUser}`);
            if (dataCache) {
                arrData = JSON.parse(dataCache);
                const stringData = arrData.find((obj) => obj.key === fileName);
                const dataRes = Buffer.from(stringData.data, 'base64');
                checkCache = true;
                res.json({
                    type: "cache",
                    data: dataRes,
                    metadata: metadata
                });
            }

            if (!checkCache) {
                let sizeFile = 0;
                if (metadata.size) {
                    sizeFile = metadata.size;
                }
                else {
                    const metadataDb = await getSizeFile(req.session.user.idUser, fileName);
                    sizeFile = parseInt(metadataDb.size);
                    metadata = {
                        size: metadataDb.size,
                        type: metadataDb.type,
                        encoding: metadataDb.encoding,
                        name: fileName,
                        url: metadataDb.url,
                        versionId: metadataDb.versionId
                    };
                    let newMetadatas = [];
                    if (metadatas) {
                        newMetadatas = [...metadatas];
                    }
                    newMetadatas.push({ ...metadata });
                    client.set(`${req.session.user.idUser}`, JSON.stringify(newMetadatas));
                    console.log(sizeFile);
                }

                if (sizeFile < 20971520) {
                    console.log("Get small file");
                    const params = {
                        Bucket: process.env.BUCKET,
                        Key: fileName,
                        VersionId: metadata.versionId
                    };
                    s3.getObject(params, function (err, data) {
                        if (err) next(err);
                        else {
                            let newData = [...arrData];
                            newData.push({
                                key: fileName,
                                data: data.Body.toString('base64')
                            });
                            memcached.set(`${req.session.user.idUser}`, JSON.stringify(newData), 600, (err) => {
                                if (err) {
                                    next(err);
                                }
                            });
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
                            return getPartFile(s3, metadata.versionId, fileName, part * chunkSize, (part + 1) * chunkSize - 1, part + 1)
                        })
                    );
                    const resBuffs = arrBuffs.reduce((buff, currentBuff) => {
                        return buff.concat(currentBuff.data);
                    }, []);
                    const buffers = Buffer.concat(resBuffs);
                    console.log("buffers", buffers)
                    res.json({
                        type: "no-cache",
                        data: buffers,
                        metadata: metadata
                    })
                }
            }
        }
        else {
            res.json("Session has expired");
        }
    } catch (error) {
        next(error);
    }
};

const upFile = async (req, res, next) => {
    try {
        if (req.session.user) {
            const s3 = new AWS.S3();
            const resUrl = [];
            let checkUp = false;
            for (let i = 0; i < req.files.length; i++) {
                let url = '';
                let metadataRes = {};
                console.log(req.files[i]);
                if (req.files[i].size < 20971520) {
                    console.log("Up small size")
                    const params = { Bucket: process.env.BUCKET, Key: req.files[i].originalname, Body: req.files[i].buffer };
                    const data = await upload(params, s3);
                    metadataRes = { ...data };
                    console.log(data)
                    if (data.Location) {
                        checkUp = true;
                        url = data.Location;
                        resUrl.push(data.Location);
                    }
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
                        checkUp = true;
                        url = dataRes.Location;
                        metadataRes = { ...dataRes };
                        resUrl.push(dataRes.Location);
                    };
                }

                if (checkUp) {
                    const sqlCheck = `SELECT * FROM metadatas where name='${req.files[i].originalname}'`;
                    connect.query(sqlCheck, (err, data) => {
                        if (err) return next(err);
                        if (data[0]) {
                            const sql = `UPDATE metadatas SET type="${req.files[i].mimetype}",size="${req.files[i].size}",versionId="${metadataRes.VersionId}",encoding="${req.files[i].encoding}" WHERE name='${req.files[i].originalname}'`;
                            connect.query(sql, (error, result) => {
                                if (error) return next(error);
                                console.log(result);
                            });
                        }
                        else {
                            const sql = `insert into metadatas(size,type,name,versionId,userId,encoding,url) values('${req.files[i].size}','${req.files[i].mimetype}','${req.files[i].originalname}','${metadataRes.VersionId}',${req.session.user.idUser},'${req.files[i].encoding}','${url}')`;
                            connect.query(sql, (err, data) => {
                                if (err) return next(err);
                                console.log(data);
                            });
                        }
                    });
                }

                if (i === req.files.length - 1) {
                    res.json(resUrl);
                }
            }
        }
        else {
            res.json("Session has expired");
        }
    } catch (error) {
        next(error);
    }
};

const deleteFile = async (req, res, next) => {
    try {
        if (req.session.user) {
            const s3 = new AWS.S3();
            const fileName = req.query["file-name"];
            const verId = req.query["version-id"];
            const params = {
                Bucket: process.env.BUCKET,
                Key: fileName,
                VersionId: verId
            };
            s3.deleteObject(params, async function (err, data) {
                if (err) {
                    console.log(err.message);
                    next(err);
                }
                else {
                    const sql = `DELETE FROM metadatas WHERE versionId="${verId}"`;
                    connect.query(sql, (err, data) => {
                        if (err) return next(err);
                        else {
                            console.log(data);
                        }
                    });
                    const metadataJson = await client.get(`${req.session.user.idUser}`);
                    const metadatas = JSON.parse(metadataJson);
                    if (metadatas) {
                        const metadata = metadatas.find((metadata) => metadata.name === fileName);
                        if (metadata) {
                            const newMetadatas = metadatas.filter((meta) => meta.name !== fileName);
                            if (newMetadatas.length === 0) {
                                client.del(`${req.session.user.idUser}`);
                            }
                            else {
                                client.set(`${req.session.user.idUser}`, JSON.stringify(newMetadatas));
                            }
                        }
                    }
                    const dataCache = await getData(`${req.session.user.idUser}`);
                    if (dataCache) {
                        const arrData = JSON.parse(dataCache);
                        const stringData = arrData.find((obj) => obj.key === fileName);
                        if (stringData) {
                            const newDataCache = arrData.filter((data) => data.key !== fileName);
                            if (newDataCache.length === 0) {
                                memcached.del(`${req.session.user.idUser}`, (err) => {
                                    if (err) return next(err);
                                });
                            }
                            else {
                                memcached.set(`${req.session.user.idUser}`, JSON.stringify(newDataCache), 600, (err) => {
                                    if (err) {
                                        next(err);
                                    }
                                });
                            }
                        }
                    }
                    console.log("Done");
                    res.json("Success");
                }
            });
        }
        else {
            res.json("Session has expired");
        }

    } catch (error) {
        next(error);
    }
};

const getListFile = async (req, res, next) => {
    try {
        if (req.session.user) {
            const sql = `SELECT * FROM metadatas where userId=${req.session.user.idUser}`;
            connect.query(sql, (err, data) => {
                if (err) return next(err);
                res.json(data);
            });
        }
        else {
            res.json("Session has expired");
        }
    } catch (error) {
        next(error);
    }
};

const getAllFile = (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
};

const getTotalSizeBucket = async (req, res, next) => {
    if (req.session.user) {
        const sql = `SELECT * FROM metadatas where userId=${req.session.user.idUser}`;
        let total = 0;
        connect.query(sql, (err, data) => {
            if (err) return next(err);
            if (data.length !== 0) {
                total = data.reduce((current, value) => {
                    return current + parseInt(value.size);
                }, 0);
            }
            res.json(total);
        });
    }
    else {
        res.json("Session has expired");
    }
};

const getSignUp = async (req, res, next) => {
    // if (req.session.user) {
        
    // }
    // else {
    //     res.json("Session has expired");
    // }
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
};

const getSignDown = async (req, res, next) => {
    if (req.session.user) {
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
                console.log("Error", err);
            } else {
                console.log("Success", data);
            }
        });

        const fileName = req.query["file-name"];
        const params = {
            Bucket: process.env.BUCKET,
            Key: fileName,
            Expires: 180,
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
    }
    else {
        res.json("Session has expired");
    }
};

const deleJunkFile = (req, res, next) => {
    const s3 = new AWS.S3();
    const fileName = req.query["file-name"];
    const verId = req.query["version-id"];
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        VersionId: verId
    };
    s3.deleteObject(params, async function (err, data) {
        if (err) {
            console.log(err.message);
            next(err);
        }
        else {
            res.json("Done");
        }
    }
    )
}

const getJunkFile = (req, res, next) => {
    const s3 = new AWS.S3();
    const fileName = req.query["file-name"];
    const verId = req.query["version-id"];
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        VersionId: verId
    };
    s3.getObject(params, async function (err, data) {
        if (err) {
            console.log(err.message);
            next(err);
        }
        else {
            res.json(data);
        }
    }
    )
}

module.exports = { upFile, saveFile, deleteFile, getListFile, getTotalSizeBucket, getSignUp, getSignDown, getAllFile, deleJunkFile, getJunkFile };