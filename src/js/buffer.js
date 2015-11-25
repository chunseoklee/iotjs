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


var bufferBuiltin = process.binding(process.binding.buffer);
var util = require('util');


// Buffer constructor
// [1] new Buffer(size)
// [2] new Buffer(buffer)
// [3] new Buffer(string[, encoding])
function Buffer(subject, encoding) {
  if (!util.isBuffer(this)) {
    return new Buffer(subject);
  }

  if (util.isNumber(subject)) {
    this.length = subject > 0 ? subject >>> 0 : 0;
  } else if (util.isString(subject)) {
    this.length = Buffer.byteLength(subject, encoding);
  } else if (util.isBuffer(subject)) {
    this.length = subject.length;
  } else {
    throw new TypeError('Bad arguments: Buffer(string|number|Buffer)');
  }

  this._builtin = new bufferBuiltin(this, this.length);

  if (util.isString(subject)) {
    this.write(subject, (encoding ? encoding : 'utf8'));
  } else if (util.isBuffer(subject)) {
    subject.copy(this);
  }
};


function base64Length(str) {
  var len = str.length;
  if (str.charCodeAt(len - 1) == 61)
    len--;
  if (len > 1 && str.charCodeAt(len - 1) == 61)
    len--;
  // Base64 ratio: 3/4
  return (len * 3) >>> 2;
}


// Buffer.byteLength(string)
Buffer.byteLength = function(str, enc) {
  var ret;
  str = str + '';

  if (util.isUndefined(enc)) enc = 'utf8';

  switch (enc) {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length;
      break;
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2;
      break;
    case 'hex':
      ret = str.length >>> 1;
      break;
    case 'utf8':
    case 'utf-8':
      ret = bufferBuiltin.utf8Length(str);
      break;
    case 'base64':
      ret = base64Length(str);
      break;
    default:
      throw new TypeError('Error: Unsupported encoding');
  }
  return ret;
};


// Buffer.concat(list)
Buffer.concat = function(list) {
  if (!util.isArray(list)) {
    throw new TypeError('Bad arguments: Buffer.concat([Buffer])');
  }

  var length = 0;
  for (var i = 0; i < list.length; ++i) {
    if (!util.isBuffer(list[i])) {
      throw new TypeError('Bad arguments: Buffer.concat([Buffer])');
    }
    length += list[i].length;
  }

  var buffer = new Buffer(length);
  var pos = 0;
  for (var i = 0; i < list.length; ++i) {
    list[i].copy(buffer, pos);
    pos += list[i].length;
  }

  return buffer;
};


// Buffer.isBuffer(object)
Buffer.isBuffer = function(object) {
  return util.isBuffer(object);
};


// buffer.equals(otherBuffer)
Buffer.prototype.equals = function(otherBuffer) {
  if (!util.isBuffer(otherBuffer)) {
    throw new TypeError('Bad arguments: buffer.equals(Buffer)');
  }

  return this._builtin.compare(otherBuffer) == 0;
};


// buffer.compare(otherBuffer)
Buffer.prototype.compare = function(otherBuffer) {
  if (!util.isBuffer(otherBuffer)) {
    throw new TypeError('Bad arguments: buffer.compare(Buffer)');
  }

  return this._builtin.compare(otherBuffer);
};


// buffer.copy(target[, targetStart[, sourceStart[, sourceEnd]]])
// [1] buffer.copy(target)
// [2] buffer.copy(target, targetStart)
// [3] buffer.copy(target, targetStart, sourceStart)
// [4] buffer.copy(target, targetStart, sourceStart, sourceEnd)
// * targetStart - default to 0
// * sourceStart - default to 0
// * sourceEnd - default to buffer.length
Buffer.prototype.copy = function(target, targetStart, sourceStart, sourceEnd) {
  if (!util.isBuffer(target)) {
    throw new TypeError('Bad arguments: buff.copy(Buffer)');
  }

  targetStart = util.isUndefined(targetStart) ? 0 : ~~targetStart;
  sourceStart = util.isUndefined(sourceStart) ? 0 : ~~sourceStart;
  sourceEnd = util.isUndefined(sourceEnd) ? this.length : ~~ sourceEnd;

  targetStart = boundRange(targetStart, 0, target.length);
  sourceStart = boundRange(sourceStart, 0, this.length);
  sourceEnd = boundRange(sourceEnd, 0, this.length);

  if (sourceEnd < sourceStart) {
    sourceEnd = sourceStart;
  }

  return this._builtin.copy(target, targetStart, sourceStart, sourceEnd);
};

function isEncoding(enc) {
  if (enc == 'utf8' || enc == 'utf-8' || enc == 'utf16le' ||
      enc == 'utf-16le' || enc == 'base64' || enc == 'ascii' ||
      enc == 'raw')
    return true;
  else
    return false;
}

// buffer.write(string[, offset[, length]], [encoding])
// [1] buffer.write(string)
// [2] buffer.write(string, offset)
// [3] buffer.write(string, offset, length)
// [4] buffer.write(string, offset, length, encoding)
// [5] buffer.write(string, encoding)
// * offset - default to 0
// * length - default to buffer.length - offset
Buffer.prototype.write = function(string, offset, length, encoding) {
  if (!util.isString(string)) {
    throw new TypeError('Bad arguments: buff.write(string)');
  }

  if (util.isUndefined(encoding))
    encoding = 'utf8';

  if (isEncoding(offset)) {  // write(string, encoding)
    encoding = offset;
    offset = 0;
  }

  offset = util.isUndefined(offset) ? 0 : ~~offset;
  offset = boundRange(offset, 0, this.length);


  var remaining = this.length - offset;
  length = util.isUndefined(length) ? remaining : ~~length;
  length = boundRange(length, 0, remaining);

  return this._builtin.write(string, offset, length, encoding);
};


// buff.slice([start[, end]])
// [1] buff.slice()
// [2] buff.slice(start)
// [3] buff.slice(start, end)
// * start - default to 0
// * end - default to buff.length
Buffer.prototype.slice = function(start, end) {
  start = util.isUndefined(start) ? 0 : ~~start;
  end = util.isUndefined(end) ? this.length : ~~end;

  if (start < 0) {
    start += this.length;
  }
  start = boundRange(start, 0, this.length);

  if (end < 0) {
    end += this.length;
  }
  end = boundRange(end, 0, this.length);

  if (end < start) {
    end = start;
  }

  return this._builtin.slice(start, end);
};


// buff.toString([,start[, end]])
// [1] buff.toString()
// [2] buff.toString(start)
// [3] buff.toString(start, end)
// * start - default to 0
// * end - default to buff.lengfth
Buffer.prototype.toString = function(start, end) {
  start = util.isUndefined(start) ? 0 : ~~start;
  end = util.isUndefined(end) ? this.length : ~~end;

  start = boundRange(start, 0, this.length);
  end = boundRange(end, 0, this.length);

  if (end < start) {
    end = start;
  }

  return this._builtin.toString(start, end);
};


function boundRange(v, low, upper) {
  if (v < low) return low;
  if (v > upper) return upper;
  return v;
}


module.exports = Buffer;
module.exports.Buffer = Buffer;
