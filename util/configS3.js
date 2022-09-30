const AWS = require("aws-sdk");

const configS3 = () => {
    AWS.config.update({
        endpoint: process.env.ENDPOINT,
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_KEY,
        s3ForcePathStyle: true
    });
};

module.exports = { AWS, configS3 };