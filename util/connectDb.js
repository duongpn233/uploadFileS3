const mysql = require('mysql');

const connect = mysql.createConnection({
    host: '127.0.0.1',
    user: process.env.USER_DB,
    password: process.env.PASS_DB,
    database: process.env.DB,
    port: 8000
});

const connectDb = () => {
    connect.connect(function (err) {
        if (err) throw err;
        console.log("Connected database!!!")
    });
};

module.exports = { connect, connectDb };

