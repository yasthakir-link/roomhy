const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.get('/test', (req, res) => {
    console.log('Received request for /test');
    res.json({ message: 'Test successful' });
});

server.listen(3000, 'localhost', () => {
    console.log('Test server running on http://localhost:3000');
});

server.on('error', (err) => {
    console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});
