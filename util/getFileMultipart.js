const { connect } = require('../util/connectDb');

const getSizeFile = (userId, fileName) => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM metadatas where name='${fileName}' and userId=${userId}`;
        connect.query(sql, (err, data) => {
            if (err) reject(err);
            else resolve(data[0]);
        });
    });
};

const getPartFile = (s3, verId ,fileName, start, end, partNumber) => {
    const params = {
        Bucket: process.env.BUCKET,
        Key: fileName,
        VersionId: verId,
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

module.exports = { getSizeFile, getPartFile };