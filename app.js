require('dotenv').config();
const express = require('express');
const cros = require('cors');
// const AWS = require("aws-sdk");
const bodyParser = require('body-parser');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { connectRedis } = require('./util/connectRedis');
const uploadRoute = require('./router/upload');
const bucketRoute = require('./router/bucket');
const userRoute = require('./router/user');
const { connectDb } = require('./util/connectDb');
const { configS3 } = require('./util/configS3');

const options = {
    host: '127.0.0.1',
    user: process.env.USER_DB,
    password: process.env.PASS_DB,
    database: process.env.DB,
    port: 8000,
    clearExpired: true,
    expiration: 2 * 60 * 60 * 1000,
    createDatabaseTable: true
};

const sessionStore = new MySQLStore(options);

connectDb();

connectRedis();

configS3();

// AWS.config.update({
//     endpoint: process.env.ENDPOINT,
//     accessKeyId: process.env.ACCESS_KEY,
//     secretAccessKey: process.env.SECRET_KEY,
//     s3ForcePathStyle: true
// });

const app = express();
app.use(cros({
    credentials: true
}));
app.use(session({
    secret: process.env.SECRET_SESSION,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 2 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        // sameSite: 'lax'
    }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(userRoute);
app.use(uploadRoute);
app.use(bucketRoute);

app.use((err, req, res) => {
    const status = err.status || 500;
    console.log(err);
    res.json({
        error: {
            message: err.message
        }
    })
});

app.listen(5000, () => {
    console.log("Sever is listening...");
});

