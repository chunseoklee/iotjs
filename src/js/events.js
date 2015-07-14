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


function EventEmitter() {
  this._events = {};
};

module.exports.EventEmitter = EventEmitter;


// TODO: using arguments instead of arg1, arg2.
EventEmitter.prototype.emit = function(type, arg1, arg2) {
  if(type == 'end'){
    console.log('emit end start:');
    if(this.statusCode) console.log('this is incoming:' + this.statusCode);
  }

  if (!this._events) {
    this._events = {};
  }

  var handler = this._events[type];
  if (util.isUndefined(handler)) {
    if(type == 'end') console.log('false hanedler\n');
    return false;
  } else if (util.isFunction(handler) || util.isObject(handler)) {
    if (util.isFunction(handler)) {
      if(type == 'end') console.log('single end handler called\n');
      handler.call(this, arg1, arg2);
    } else {

      listeners = handler;
      for (i = 0; i < listeners.length; ++i) {
        if(type == 'end' && arg1 == undefined)
          console.log('multiple end handler called' + i);
        listeners[i].call(this, arg1, arg2);
      }
    }
  }

  return true;
};


EventEmitter.prototype.addListener = function(type, listener) {
  if (!util.isFunction(listener)) {
    throw new TypeError('listener must be a function');
  }

  if (!this._events) {
    this._events = {};
  }
  if (!this._events[type]) {
    this._events[type] = [];
  }

  this._events[type].push(listener);
  if(type == 'end'){
    console.log('add Listener end' +
                this._events[type].length);
    if(this.statusCode) console.log('this is incoming:' + this.statusCode);
  }
  if(type == 'data') console.log('add Listener data' +
                                this._events[type].length);
  return this;
};


EventEmitter.prototype.on = EventEmitter.prototype.addListener;


EventEmitter.prototype.once = function(type, listener) {
  if(type == 'end') console.log('add Listener once end');
  if (!util.isFunction(listener)) {
    throw new TypeError('listener must be a function');
  }

  function f(arg1, arg2) {
    // here `this` is this not global, because EventEmitter binds event object
    // for this when it calls back the handler.
    this.removeListener(f.type, f);
    f.listener.call(this, arg1, arg2);
  };
  f.type = type;
  f.listener = listener;

  this.on(type, f);

  return this;
};


EventEmitter.prototype.removeListener = function(type, listener) {
  if(type == 'end') console.log('remove Listener end' +
                                this._events[type].length);

  if (!util.isFunction(listener)) {
    throw new TypeError('listener must be a function');
  }

  var list = this._events[type];
  if (Array.isArray(list)) {
    for (var i = list.length - 1; i >= 0; --i) {
      if (list[i] == listener) {
        list.splice(i, 1);
        this.emit('removeListener', type, listener);
        break;
      }
    }
  }

  return this;

};
