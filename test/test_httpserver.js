/* Copyright 2015 Samsung Electronics Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var assert = require('assert');
var http = require('http');

var server = http.createServer(function (req, res) {
  // req is an http.IncomingMessage, which is a Readable Stream
  // res is an http.ServerResponse, which is a Writable Stream

  var body = '';
  var url = req.url;

  req.on('data', function (chunk) {
    body += chunk;
  });

  var endHandler = function () {

    console.log('server req ended.');
    res.writeHead(200, { "Connection" : "close",
                         "Content-Length": body.length+3
                       });
    res.write(body);
    res.end('end', function(){
     console.log('server response ended in server side. Now closing server...');
     server.close();
    });
  };

  req.on('end', endHandler);

});


server.listen(3001,2,function cb(){
  console.log("server listening....");
});


var msg = 'http request test msg';
var options = {
  method:'POST',
  port:3001,
  headers : {'Content-Length': msg.length}
};


var responseHandler = function (res) {
  var res_body = '';

  console.log("server response's STATUS: "+res.statusCode);

  var endHandler = function(){
    console.log('server res ended in client side');
    assert.equal(msg+'end', res_body);
  };
  res.on('end', endHandler);

  res.on('data', function(chunk){
    res_body += chunk.toString();
  });
};

var req2 = http.request(options, responseHandler);
req2.write(msg);
req2.end();




server.on('close', function() {
  console.log("server closed.");
});
