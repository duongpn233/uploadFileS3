const uploadPart = (s3, buffer, uploadId, partNumber, fileName) => {
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        Body: buffer,
        PartNumber: partNumber,
        UploadId: uploadId
    };
    return new Promise((resolve, reject) => {
        s3.uploadPart(params, (err, data) => {
            console.log("Uploading...")
            if (err) {
                console.log(err)
                reject(err);
            }
            else {
                console.log("Success", data)
                resolve({
                    PartNumber: partNumber,
                    ETag: data.ETag
                });
            }
        });
    });
};

const createMultipart = (s3, fileName) => {
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName
    };
    return new Promise((resolve, reject) => {
        s3.createMultipartUpload(params, (err, data) => {
            if (err) reject(err);
            else resolve(data.UploadId);
        });
    });
};

const abortUpload = (s3, uploadId, fileName) => {
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        UploadId: uploadId
    };
    return new Promise((resolve, reject) => {
        s3.abortMultipartUpload(params, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
};

const completeUpload = (s3, uploadId, parts, fileName) => {
    const parmas = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        UploadId: uploadId,
        MultipartUpload: {
            Parts: parts
        }
    };
    return new Promise((resolve, reject) => {
        s3.completeMultipartUpload(parmas, (err, data) => {
            console.log("Completed")
            if (err) reject(err);
            else resolve(data);
        });
    });
};

const upload = (params, s3) => {
    return new Promise((resolve, reject) => {
        s3.upload(params, (err, data) => {
            console.log(data);
            if (err) reject(err);
            else resolve(data);
        });
    });
}

module.exports = { uploadPart, createMultipart, completeUpload, abortUpload, upload };