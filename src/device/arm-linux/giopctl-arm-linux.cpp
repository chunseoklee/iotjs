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

#include "iotjs_def.h"
#include "iotjs_module_gpioctl.h"
#include <unistd.h>

namespace iotjs {


class GpioControlImpl : public GpioControl {
public:
  explicit GpioControlImpl(JObject& jgpioctl);

  virtual int Initialize(void);
  virtual void Release(void);
  virtual int SetPin(GpioCbData* setpin_data, GpioCb cb);
  virtual int WritePin(GpioCbData* data, GpioCb cb);
  virtual int ReadPin(GpioCbData* data, GpioCb cb);
};


//-----------------------------------------------------------------------------

GpioControl* GpioControl::Create(JObject& jgpioctl)
{
  return new GpioControlImpl(jgpioctl);
}


GpioControlImpl::GpioControlImpl(JObject& jgpioctl)
    : GpioControl(jgpioctl) {
}


int GpioControlImpl::Initialize(void) {
  if (_fd > 0 )
    return GPIO_ERR_INITALIZE;

  _fd = 1;
  return _fd;
}


void GpioControlImpl::Release(void) {
  _fd = 0;
}


class GpioWrap {
public:
  GpioWrap(GpioCbData* data, GpioCb cb) {
    _data = data; _cb = cb;
  }
  GpioCbData* data() { return _data; }
  GpioCb cb() { return _cb; }

private:
  GpioCbData* _data;
  GpioCb _cb;
};


void WorkSetPin(uv_work_t *req){
  GpioWrap* gr = reinterpret_cast<GpioWrap*>(req->data);
  GpioCbData* data = gr->data();
  FILE* fd = NULL;
  FILE* dir = NULL;
  // TODO: mode
  char dirname[82];

  switch (data->dir) {
  case GPIO_DIR_NONE:
    fd = fopen("/sys/class/gpio/unexport","w");
    fprintf(fd, "%u", data->pin);
    fclose(fd);
    break;

  case GPIO_DIR_IN:
    fd = fopen("/sys/class/gpio/export","w");
    fprintf(fd, "%u", data->pin);
    fclose(fd);
    usleep(100000); // bad workaround

    sprintf(dirname,"/sys/class/gpio/gpio%d/direction", data->pin);
    dir = fopen(dirname,"w");
    fprintf(dir,"in");
    fclose(dir);
    break;

  case GPIO_DIR_OUT:
    fd = fopen("/sys/class/gpio/export","w");
    fprintf(fd, "%u", data->pin);
    fclose(fd);
    usleep(100000); // bad workaround

    sprintf(dirname,"/sys/class/gpio/gpio%d/direction", data->pin);
    dir = fopen(dirname,"w");
    fprintf(dir,"out");
    fclose(dir);
    break;

  }
}


void WorkWritePin(uv_work_t *req){
  GpioWrap* gr = reinterpret_cast<GpioWrap*>(req->data);
  GpioCbData* data = gr->data();
  FILE* value = NULL;
  char valuename[82];

  sprintf(valuename,"/sys/class/gpio/gpio%d/value", data->pin);
  value = fopen(valuename,"w");
  fprintf(value, "%u", (data->value?1:0));
  fclose(value);
}


void WorkReadPin(uv_work_t *req){
  GpioWrap* gr = reinterpret_cast<GpioWrap*>(req->data);
  GpioCbData* data = gr->data();
  FILE* value = NULL;
  char valuename[82];
  int v;

  sprintf(valuename,"/sys/class/gpio/gpio%d/value", data->pin);
  value = fopen(valuename,"r");
  fscanf(value, "%u", &v);
  data->value = v;
  fclose(value);
}


void AfterWork(uv_work_t *req, int status) {
  GpioWrap* gr = reinterpret_cast<GpioWrap*>(req->data);
  GpioCb cb = gr->cb();
  if (cb) {
    cb((gr->data()), 0);
  }
  delete gr;
  delete req;
}


int GpioControlImpl::SetPin(GpioCbData* data, GpioCb cb) {
  Environment* env = Environment::GetEnv();
  // Exploit uv_work_t since one setpin call
  // consists of 4 file operations.
  uv_work_t* req = new uv_work_t;
  GpioWrap* gr = new GpioWrap(data, cb);
  req->data = gr;
  uv_queue_work(env->loop(), req, WorkSetPin, AfterWork);

  return 0;
}


int GpioControlImpl::WritePin(GpioCbData* data, GpioCb cb) {
  Environment* env = Environment::GetEnv();
  uv_work_t* req = new uv_work_t;
  GpioWrap* gh = new GpioWrap(data, cb);
  req->data = gh;
  uv_queue_work(env->loop(), req, WorkWritePin, AfterWork);

  return 0;
}


int GpioControlImpl::ReadPin(GpioCbData* data, GpioCb cb) {
  Environment* env = Environment::GetEnv();
  uv_work_t* req = new uv_work_t;
  GpioWrap* gh = new GpioWrap(data, cb);
  req->data = gh;
  uv_queue_work(env->loop(), req, WorkReadPin, AfterWork);

  return 0;
}


} // namespace iotjs
