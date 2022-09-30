const { createClient } = require('redis');

const client = createClient();
const connectRedis = async () => {
    client.on('error', (err) => console.log('Redis Client Error', err));
    await client.connect();
    const value = await client.get('test');
    console.log(value);
};

module.exports = { client, connectRedis };