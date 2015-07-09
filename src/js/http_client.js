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

var util = require('util');
var net = require('net');
var HTTPParser = process.binding(process.binding.httpparser).HTTPParser;
var IncomingMessage = require('http_incoming').IncomingMessage;
var OutgoingMessage = require('http_outgoing').OutgoingMessage;
var Buffer = require('buffer');
var common = require('http_common');


function ClientRequest(options, cb) {
  var self = this;
  OutgoingMessage.call(self);


  var port = options.port = options.port || 80;
  var host = options.host = options.hostname || '127.0.0.1';
  var method = options.method || 'GET';

  self.path = options.path || '/';

  var firstHeaderLine = method + ' ' + self.path + ' ' +
        'HTTP/1.1\r\n';

  if (options.headers) {
    var keys = Object.keys(options.headers);
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      self.setHeader(key, options.headers[key]);
    }
  }

  if (cb) {
    self.on('response', cb);
  }

  var conn = new net.Socket();

  conn.connect(port, host);


  self.on('socket', function(socket){
    console.log('socket event emitted');
    self._storeHeader(firstHeaderLine);
    // cf) in node, request are alloc in free list, we dont.
    // Also, we do not buffer things on write call.
    // flush header
    self.write('');
  });

  self.onSocket(conn);
}

util.inherits(ClientRequest, OutgoingMessage);


exports.ClientRequest = ClientRequest;


ClientRequest.prototype.onSocket = function(socket) {
  var req = this;

  // In iotjs, no reserved socket.
  // we assume that socket already ready.
  tickOnSocket(req, socket);

};


function tickOnSocket(req, socket) {
  console.log("tickOn Socket");
  var parser = common.createHTTPParser();
  parser.reinitialize(HTTPParser.RESPONSE);
  req.socket = socket;
  req.connection = socket;
  parser.socket = socket;
  parser.incoming = null;
  req.parser = parser;

  socket.parser = parser;
  socket._httpMessage = req;

  parser.onIncoming = parserOnIncomingClient;
  //socket.on('error', socketErrorListener);
  socket.on('data', socketOnData);
  socket.on('end', socketOnEnd);
  //socket.on('close', socketCloseListener);

  // socket emitted when a socket is assigned to req
  req.emit('socket', socket);
}


function socketOnData(d) {
  console.log('http_client socketOnData:\n' + d.toString());
  var socket = this;
  var req = this._httpMessage;
  var parser = this.parser;

  var ret = parser.execute(d);
  if (ret instanceof Error) {
    delete parser;
    socket.destroy();
    req.emit('error', ret);
  }
}


function socketOnEnd() {
  console.log('http_client socketOnEnd');
  var socket = this;
  var req = this._httpMessage;
  var parser = this.parser;

  if (parser) {
    parser.finish();
    delete parser;
  }
  socket.destroy();
}


function parserOnIncomingClient(res, shouldKeepAlive) {
  console.log('client parseronincoming');
  var socket = this.socket;
  var req = socket._httpMessage;

  if (req.res) {
    // We already have a response object, this means the server
    // sent a double response.
    socket.destroy();
    return;
  }
  req.res = res;

  var isHeadResponse = req.method === 'HEAD';

  res.req = req;

  // add our listener first, so that we guarantee socket cleanup
  res.on('end', responseOnEnd);

  //req.emit('response', res);

  return isHeadResponse;
}

function responseOnEnd() {
  var res = this;
  var req = res.req;
  var socket = req.socket;

  socket.destroySoon();
}
