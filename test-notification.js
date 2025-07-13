const https = require('https');
const http = require('http');

// Test data
const postData = JSON.stringify({
  title: 'Test Notification',
  message: 'This is a test notification created via Node.js',
  type: 'info'
});

// Request options
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/notifications',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InJ2bkt0ekRVMXhhRnBvNENCMWN6V3oza3JEOTIiLCJyb2xlIjoiY3VzdG9tZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwiaWF0IjoxNzUyNDM4ODYwLCJleHAiOjE3NTI1MjUyNjB9.t73EnruJr2yLeIYribe3K72yUc6LFU3W9qYNIP18fQE',
    'Content-Length': Buffer.byteLength(postData)
  }
};

// Make the request
const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

// Write data to request body
req.write(postData);
req.end();