const getSizeFile = (s3, fileName) => {
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName
    };
    return new Promise((resolve, reject) => {
        s3.headObject(params, function (err, data) {
            console.log("Get size...");
            if (err) reject(err);
            else resolve(data.ContentLength);
        });
    })
};

const getPartFile = (s3, fileName, start, end, partNumber) => {
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        Range: `bytes=${start}-${end}`
    };
    return new Promise((resolve, reject) => {
        s3.getObject(params, function (err, data) {
            console.log("Get part file...");
            if (err) reject(err);
            else {
                console.log(data.Body);
                resolve({
                    partNumber,
                    data: data.Body
                });
            }
        });
    })
}

module.exports = { getSizeFile, getPartFile};