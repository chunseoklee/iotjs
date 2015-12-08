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


function isNull(arg) {
  return arg === null;
}


function isUndefined(arg) {
  return arg === undefined;
}


function isNullOrUndefined(arg) {
  return isNull(arg) || isUndefined(arg);
}


function isNumber(arg) {
  return typeof arg === 'number';
}


function isBoolean(arg) {
  return typeof arg === 'boolean';
}


function isString(arg) {
  return typeof arg === 'string';
}


function isObject(arg) {
  return typeof arg === 'object' && arg != null;
}


function isFunction(arg) {
  return typeof arg === 'function';
}


function isBuffer(arg) {
  return arg instanceof Buffer;
}


function isEncoding(arg) {
  if (arg == 'utf8' || arg == 'utf-8' || arg == 'utf16le' ||
      arg == 'ucs2' || arg == 'ucs-2' || arg == 'raw' ||
      arg == 'utf-16le' || arg == 'base64' || arg == 'ascii') {
    return true;
  }

  return false;
}


function inherits(ctor, superCtor) {
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};


function format(s) {
  if (!isString(s)) {
    var arrs = [];
    for (var i = 0; i < arguments.length; ++i) {
        arrs.push(formatValue(arguments[i]));
    }
    return arrs.join(' ');
  }

  var i = 1;
  var args = arguments;
  var str = String(s).replace(/%[sdj%]/g, function(m) {
    if (m === '%%') {
      return '%';
    }
    if (i >= args.length) {
      return m;
    }
    switch (m) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j': return '[JSON object]';
      default: return m;
    }
  });

  while (i < args.length) {
      str += ' ' + args[i++].toString();
  }

  return str;
}

function formatValue(v) {
  if (isUndefined(v)) {
    return 'undefined';
  } else if (isNull(v)) {
    return 'null';
  } else {
    return v.toString();
  }
}


exports.isNull = isNull;
exports.isUndefined = isUndefined;
exports.isNullOrUndefined = isNullOrUndefined;
exports.isNumber = isNumber;
exports.isBoolean = isBoolean;
exports.isString = isString;
exports.isObject = isObject;
exports.isFunction = isFunction;
exports.isBuffer = isBuffer;
exports.isArray = Array.isArray;
exports.isEncoding = isEncoding;
exports.inherits = inherits;

exports.format = format;
