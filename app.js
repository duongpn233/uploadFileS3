require('dotenv').config();
const express = require('express');
const cros = require('cors');
const AWS = require("aws-sdk");

AWS.config.update({
    accessKeyId: 'UHhVVP04jUnR9aQAXUfG',
    secretAccessKey: 'YkPNBFfCKxsImjUj2bfphNtJ02k3HaUN1ujNf62Y'
});

const app = express();
app.use(cros());


app.get("/sign-s3", (req, res, next) => {
    const s3 = new AWS.S3();
    const fileName = req.query["file-name"];
    const fileType = req.query["file-type"];
    console.log(process.env.BUCKET)
    const params = {
        Bucket: 'traffic',
        Key: fileName,
        Expires: 180,
        ContentType: fileType,
        ACL: "public-read"
    };
    s3.getSignedUrl("putObject", params, (err, data) => {
        if (err) {
            console.log(err);
            return next(err);
        }
        else {
            return res.status(200).json(data);
        }
    })
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
})
