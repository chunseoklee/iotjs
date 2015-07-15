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

var EventEmitter = require('events');
var util = require('util');
var net = require('net');
var HTTPParser = process.binding(process.binding.httpparser).HTTPParser;
var IncomingMessage = require('http_incoming').IncomingMessage;
var OutgoingMessage = require('http_outgoing').OutgoingMessage;
var Buffer = require('buffer');
var common = require('http_common');

var STATUS_CODES = exports.STATUS_CODES = {
  100 : 'Continue',
  101 : 'Switching Protocols',
  102 : 'Processing',                 // RFC 2518, obsoleted by RFC 4918
  200 : 'OK',
  201 : 'Created',
  202 : 'Accepted',
  203 : 'Non-Authoritative Information',
  204 : 'No Content',
  205 : 'Reset Content',
  206 : 'Partial Content',
  207 : 'Multi-Status',               // RFC 4918
  300 : 'Multiple Choices',
  301 : 'Moved Permanently',
  302 : 'Moved Temporarily',
  303 : 'See Other',
  304 : 'Not Modified',
  305 : 'Use Proxy',
  307 : 'Temporary Redirect',
  308 : 'Permanent Redirect',         // RFC 7238
  400 : 'Bad Request',
  401 : 'Unauthorized',
  402 : 'Payment Required',
  403 : 'Forbidden',
  404 : 'Not Found',
  405 : 'Method Not Allowed',
  406 : 'Not Acceptable',
  407 : 'Proxy Authentication Required',
  408 : 'Request Time-out',
  409 : 'Conflict',
  410 : 'Gone',
  411 : 'Length Required',
  412 : 'Precondition Failed',
  413 : 'Request Entity Too Large',
  414 : 'Request-URI Too Large',
  415 : 'Unsupported Media Type',
  416 : 'Requested Range Not Satisfiable',
  417 : 'Expectation Failed',
  418 : 'I\'m a teapot',              // RFC 2324
  422 : 'Unprocessable Entity',       // RFC 4918
  423 : 'Locked',                     // RFC 4918
  424 : 'Failed Dependency',          // RFC 4918
  425 : 'Unordered Collection',       // RFC 4918
  426 : 'Upgrade Required',           // RFC 2817
  428 : 'Precondition Required',      // RFC 6585
  429 : 'Too Many Requests',          // RFC 6585
  431 : 'Request Header Fields Too Large',// RFC 6585
  500 : 'Internal Server Error',
  501 : 'Not Implemented',
  502 : 'Bad Gateway',
  503 : 'Service Unavailable',
  504 : 'Gateway Time-out',
  505 : 'HTTP Version Not Supported',
  506 : 'Variant Also Negotiates',    // RFC 2295
  507 : 'Insufficient Storage',       // RFC 4918
  509 : 'Bandwidth Limit Exceeded',
  510 : 'Not Extended',               // RFC 2774
  511 : 'Network Authentication Required' // RFC 6585
};


// response to req
function ServerResponse(req) {
  OutgoingMessage.call(this);
  // HEAD method has no body
  if (req.method === 'HEAD') this._hasBody = false;
}

util.inherits(ServerResponse, OutgoingMessage);


ServerResponse.prototype.statusCode = 200;
ServerResponse.prototype.statusMessage = undefined;


ServerResponse.prototype._implicitHeader = function() {
  this.writeHead(this.statusCode);
};


ServerResponse.prototype.writeHead = function(statusCode, reason, obj) {
  if (util.isString(reason)) {
    this.statusMessage = reason;
  }
  else {
    this.statusMessage = STATUS_CODES[statusCode] || 'unknown';
    obj = reason;
  }

  var statusLine = 'HTTP/1.1 ' + statusCode.toString() + ' ' +
                   this.statusMessage + "\r\n";

  this.statusCode = statusCode;

  // HTTP response without body
  if (statusCode === 204 || statusCode === 304 ||
      (100 <= statusCode && statusCode <= 199)) {
    this._hasBody = false;
  }

  var keys;
  if (obj) {
    if (this._headers === null) {
      this._headers = {};
    }
    keys = Object.keys(obj);
    for (var i=0;i<keys.length;i++) {
      var key = keys[i];
      this._headers[key] = obj[key];
    }
  }

  this._storeHeader(statusLine);
};


ServerResponse.prototype.assignSocket = function(socket) {
  socket._httpMessage = this;
  this.socket = socket;
  this.connection = socket;
  socket.on('close', onServerResponseClose);
  this.emit('socket', socket);
  //this._flush();
};

function onServerResponseClose() {
  console.log('server response close');
  if (this._httpMessage){
    console.log('_httpmsg on socket close emit');
    this._httpMessage.emit('close');

  }
}

ServerResponse.prototype.detachSocket = function(socket) {
  console.log('socket reset');
  socket._httpMessage = null;
  this.socket = this.connection = null;
};

function Server(requestListener) {
  if (!(this instanceof Server)) {
    return new Server(requestListener);
  }

  net.Server.call(this, {allowHalfOpen: true});

  if (util.isFunction(requestListener)) {
    this.addListener('request', requestListener);
  }

  this.httpAllowHalfOpen = false;

  this.on('connection', connectionListener);
  this.on('clientError', function(err,conn) {
    conn.destroy(err);
  });

}

util.inherits(Server, net.Server);


exports.Server = Server;


function connectionListener(socket) {
  var self = this;

  // cf) In Node.js, freelist returns a new parser.
  // parser initialize
  var parser = common.createHTTPParser();
  // FIXME: This should be impl. with Array
  parser._headers = {};
  parser._url = '';

  parser.onIncoming = parserOnIncoming;

  parser.socket = socket;
  parser.incoming = null;
  socket.parser = parser;

  socket.on("data", socketOnData);
  console.log('socket.on end in connectionLister server');
  socket.on("end", socketOnEnd);
  socket.on("error", socketOnError);
  socket.on("close", socketOnClose);

  function socketOnData(data) {
    var ret = parser.execute(data);

    if (ret instanceof Error) {
      socket.destroy();
    }
  }

  function socketOnClose() {
    if (this.parser) {
      parser = null;
    }
  }

  function socketOnError(e) {
    self.emit("client error on connection", e, this);
  }

  function socketOnEnd() {
    var socket = this;
    var ret = parser.finish();

    if (ret instanceof Error) {
      socket.destroy();
      return;
    }

    if (!self.httpAllowHalfOpen) {
      if (socket.writable) socket.end();
    }
  }

  function parserOnIncoming(req, shouldKeepAlive) {

    var res = new ServerResponse(req);

    res.assignSocket(socket);

    function resOnFinish() {
      res.detachSocket(socket);

      // FIXME: this is mess workaround.
      // In Node, ConnectionListener has a list of incoming msg.
      // socket.end should be called at socketOnEnd.
      socket.end();
    }

    res.on('prefinish', resOnFinish);

    self.emit('request', req, res);

    return false;
  }


}


/*function parserOnMessageComplete() {
  var parser = this;
  var stream = parser.incoming;

  stream.push(null);

  stream.socket.resume();
}

function parserOnHeadersComplete(info) {
  var parser = this;
  var headers = info.headers;
  var url = info.url;

  if (!url) {
    url = parser._url;
    parser.url = "";
  }

  if (!headers) {
    headers = parser._headers;
    // FIXME: This should be impl. with Array
    parser._headers = {};
  }


  parser.incoming = new IncomingMessage(parser.socket);
  parser.incoming.url = url;

  if (util.isNumber(info.method)) {
    // for server
    parser.incoming.method = HTTPParser.methods[info.method];
  } else {
    // for client
    parser.incoming.statusCode = info.status;
    parser.incoming.statusMessage = info.status_msg;
  }


  var flag_skipbody = false;

  flag_skipbody = parser.onIncoming(parser.incoming,
                                      info.shouldkeepalive);

  return flag_skipbody;

}

function parserOnBody(buf, start, len) {

  var parser = this;
  var stream = parser.incoming;

  if (!stream) {
    return;
  }

  // Push body part into incoming stream, which will emit 'data' event
  var body = buf.slice(start, start+len);
  stream.push(body);
}

function AddHeader(dest, src) {
  for (var i=0;i<src.length;i++) {
    dest[dest.length+i] = src[i];
  }
  dest.length = dest.length + src.length;
}

function parserOnHeaders(headers, url) {
  // FIXME: This should be impl. with Array.concat
  AddHeader(this._headers, headers);
  this._url += url;
}*/
