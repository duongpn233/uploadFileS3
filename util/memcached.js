const Memcached = require('memcached');

const memcached = new Memcached("localhost:11211");

const getData = (userId) => {
    return new Promise((resolve, reject) => {
        memcached.get(userId, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
};

module.exports = { memcached, getData };