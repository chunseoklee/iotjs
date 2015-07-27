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
var HTTPParser = process.binding(process.binding.httpparser).HTTPParser;
var IncomingMessage = require('http_incoming').IncomingMessage;
var OutgoingMessage = require('http_outgoing').OutgoingMessage;
var Buffer = require('buffer');



var createHTTPParser = function() {
  var parser = new HTTPParser(HTTPParser.REQUEST);
  // cb during  http parsing from C side(http_parser)
  parser.OnHeaders = parserOnHeaders;
  parser.OnHeadersComplete = parserOnHeadersComplete;
  parser.OnBody = parserOnBody;
  parser.OnMessageComplete = parserOnMessageComplete;
  return parser;
};

exports.createHTTPParser = createHTTPParser;


function parserOnMessageComplete() {

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

  var skipBody = parser.onIncoming(parser.incoming, info.shouldkeepalive);

  return skipBody; // always process body. thus, onbody return
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
}
