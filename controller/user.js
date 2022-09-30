const { connect } = require('../util/connectDb');

const login = (req, res, next) => {
    const sql = `SELECT * FROM users where email='${req.body["email"]}' or userName='${req.body["email"]}'`;
    connect.query(sql, (err, data) => {
        if (err) return next(err);
        if (data[0] && data[0].userName && req.body["pass"] === data[0].pass) {
            req.session.user = {
                idUser: data[0].idUser,
                userName: data[0].userName
            };
            res.json("Success");
        }
        else {
            res.json('Incorrect account information');
        }
    });
};

const register = (req, res, next) => {
    if (req.body["email"]) {
        const sqlCheck = `SELECT * FROM users where email='${req.body["email"]}' or userName='${req.body["name"]}'`;
        connect.query(sqlCheck, (err, data) => {
            if (err) return next(err);
            if (!data[0]) {
                const sql = `insert into users(email,userName,pass) values('${req.body["email"]}','${req.body["name"]}','${req.body["pass"]}')`;
                connect.query(sql, (err, data) => {
                    if (err) return next(err);
                    if (data) {
                        req.session.user = {
                            idUser: data.insertId,
                            userName: req.body["name"],
                        };
                        console.log(data)
                        res.json("Success");
                    }
                    else {
                        res.json('This account is Invalid');
                    }
                });
            }
            else {
                res.json('Account already exists');
            }
        })

    }
};

module.exports = { login, register };