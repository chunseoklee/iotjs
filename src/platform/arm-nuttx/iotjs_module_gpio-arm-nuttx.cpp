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

#if defined(__NUTTX__)


#include "iotjs_module_gpio.h"

#include <unistd.h>
#include <fcntl.h>
#include <nuttx/gpio.h>
#include <sys/ioctl.h>

#define GPIO_MAX_PINNO 10

namespace iotjs {


// GPIO implementeation for arm-nuttx target.
class GpioArmNuttx : public Gpio {
 public:
  explicit GpioArmNuttx(JObject& jgpio);

  static GpioArmNuttx* GetInstance();

  virtual int Initialize(GpioReqWrap* gpio_req);
  virtual int Release(GpioReqWrap* gpio_req);
  virtual int SetPin(GpioReqWrap* gpio_req);
  virtual int WritePin(GpioReqWrap* gpio_req);
  virtual int ReadPin(GpioReqWrap* gpio_req);

  bool _initialized;
  int _fd; // ioctl handle for gpio on nuttx
};



Gpio* Gpio::Create(JObject& jgpio) {
  return new GpioArmNuttx(jgpio);
}


GpioArmNuttx::GpioArmNuttx(JObject& jgpio)
    : Gpio(jgpio) {
  _fd = NULL;
  _initialized = false;
}


GpioArmNuttx* GpioArmNuttx::GetInstance()
{
  return static_cast<GpioArmNuttx*>(Gpio::GetInstance());
}


void AfterWork(uv_work_t* work_req, int status) {
  GpioArmNuttx* gpio = GpioArmNuttx::GetInstance();

  GpioReqWrap* gpio_req = reinterpret_cast<GpioReqWrap*>(work_req->data);
  GpioReqData* req_data = gpio_req->req();

  if (status) {
    req_data->result = kGpioErrSys;
  }

  JArgList jargs(2);
  jargs.Add(JVal::Number(req_data->result));

  switch (req_data->op) {
    case kGpioOpInitize:
    {
      if (req_data->result == kGpioErrOk) {
        gpio->_initialized = true;
      }
      break;
    }
    case kGpioOpRelease:
    {
      if (req_data->result == kGpioErrOk) {
        gpio->_initialized = false;
      }
      break;
    }
    case kGpioOpSetPin:
    case kGpioOpWritePin:
    {
      break;
    }
    case kGpioOpReadPin:
    {
      if (req_data->result == kGpioErrOk) {
        jargs.Add(JVal::Bool(req_data->value));
      }
      break;
    }

    case kGpioOpSetPort:
    case kGpioOpWritePort:
    case kGpioOpReadPort:
    {
      IOTJS_ASSERT(!"Not implemented");
      break;
    }
    default:
    {
      IOTJS_ASSERT(!"Unreachable");
      break;
    }
  }

  MakeCallback(gpio_req->jcallback(), *Gpio::GetJGpio(), jargs);

  delete work_req;
  delete gpio_req;
}


void InitializeWorker(uv_work_t* work_req) {
  GpioArmNuttx* gpio = GpioArmNuttx::GetInstance();
  IOTJS_ASSERT(gpio->_initialized == false);

  GpioReqWrap* gpio_req = reinterpret_cast<GpioReqWrap*>(work_req->data);
  GpioReqData* req_data = gpio_req->req();

  DDDLOG("GPIO InitializeWorker()");

  const char* devfilepath = "/dev/gpio";
  gpio->_fd = open(devfilepath, O_RDWR);
  DDDLOG("gpio> %s : fd(%d)", devfilepath, gpio->_fd);

  // Check if GPIO handle is OK.
  if (gpio->_fd) {
    req_data->result = kGpioErrOk;
  } else {
    req_data->result = kGpioErrInitialize;
  }
}


void ReleaseWorker(uv_work_t* work_req) {
  GpioArmNuttx* gpio = GpioArmNuttx::GetInstance();
  IOTJS_ASSERT(gpio->_initialized == false);

  GpioReqWrap* gpio_req = reinterpret_cast<GpioReqWrap*>(work_req->data);
  GpioReqData* req_data = gpio_req->req();

  DDDLOG("GPIO ReleaseWorker()");

  if (gpio->_fd) {
    close(gpio->_fd);
  }
  req_data->result = kGpioErrOk;
}


void SetPinWorker(uv_work_t* work_req) {
  GpioArmNuttx* gpio = GpioArmNuttx::GetInstance();
  IOTJS_ASSERT(gpio->_initialized == true);

  GpioReqWrap* gpio_req = reinterpret_cast<GpioReqWrap*>(work_req->data);
  GpioReqData* req_data = gpio_req->req();

  DDDLOG("GPIO SetPinWorker() - pin: %d, dir: %d, mode: %d",
         req_data->pin, req_data->dir, req_data->mode);

  if (req_data->dir == kGpioDirectionNone) {
    // Unexport GPIO pin.
    // if (!UnexportPin(req_data->pin)) {
    //   req_data->result = kGpioErrSys;
    //   return;
    // }
  } else {
    // Export GPIO pin.
    // if (!ExportPin(req_data->pin)) {
    //   req_data->result = kGpioErrSys;
    //   return;
    // }
    // // Set direction.
    // if (!SetPinDirection(req_data->pin, req_data->dir)) {
    //   req_data->result = kGpioErrSys;
    //   return;
    // }
    // // Set mode.
    // if (!SetPinMode(req_data->pin, req_data->mode)) {
    //   req_data->result = kGpioErrSys;
    //   return;
    // }
  }

  req_data->result = kGpioErrOk;
}


bool WritePin(int32_t pin, bool value) {
  IOTJS_ASSERT(pin >= 0 && pin < GPIO_MAX_PINNO);

  char value_path[64] = {0};
  //snprintf(value_path, 63, GPIO_PIN_FORMAT_VALUE, pin);

  DDDLOG("GPIO WritePin() - path: %s value: %d", value_path, value);

  char buffer[2] = {0};
  buffer[0] = value ? '1' : '0';
  //return GpioOpenWriteClose(value_path, buffer);
  return true;
}


void WritePinWorker(uv_work_t* work_req) {
  GpioArmNuttx* gpio = GpioArmNuttx::GetInstance();
  IOTJS_ASSERT(gpio->_initialized == true);

  GpioReqWrap* gpio_req = reinterpret_cast<GpioReqWrap*>(work_req->data);
  GpioReqData* req_data = gpio_req->req();

  DDDLOG("GPIO WritePinWorker() - pin: %d, value: %d",
         req_data->pin, req_data->value);

  if (WritePin(req_data->pin, req_data->value)) {
    req_data->result = kGpioErrOk;
  } else {
    req_data->result = kGpioErrSys;
  }
}


bool ReadPin(int32_t pin, int32_t* value) {
  IOTJS_ASSERT(pin >= 0 && pin < GPIO_MAX_PINNO);

  char value_path[64] = {0};
  //snprintf(value_path, 63, GPIO_PIN_FORMAT_VALUE, pin);

  DDDLOG("GPIO ReadPin() - path: %s", value_path);

  char buffer[10] = {0};
  // if (GpioOpenReadClose(value_path, buffer, 9)) {
  //   *value = atoi(buffer) ? 1 : 0;
  //   return true;
  // } else {
  //   return false;
  // }
  return true;
}


void ReadPinWorker(uv_work_t* work_req) {
  GpioArmNuttx* gpio = GpioArmNuttx::GetInstance();
  IOTJS_ASSERT(gpio->_initialized == true);

  GpioReqWrap* gpio_req = reinterpret_cast<GpioReqWrap*>(work_req->data);
  GpioReqData* req_data = gpio_req->req();

  DDDLOG("GPIO ReadPinWorker() - pin: %d" ,req_data->pin);

  if (ReadPin(req_data->pin, &req_data->value)) {
    req_data->result = kGpioErrOk;
  } else {
    req_data->result = kGpioErrSys;
  }
}


#define GPIO_NUTTX_IMPL_TEMPLATE(op, initialized) \
  do { \
    GpioArmNuttx* gpio = GpioArmNuttx::GetInstance(); \
    IOTJS_ASSERT(gpio->_initialized == initialized); \
    Environment* env = Environment::GetEnv(); \
    uv_work_t* req = new uv_work_t; \
    req->data = reinterpret_cast<void*>(gpio_req); \
    uv_queue_work(env->loop(), req, op ## Worker, AfterWork); \
  } while (0)


int GpioArmNuttx::Initialize(GpioReqWrap* gpio_req) {
  GPIO_NUTTX_IMPL_TEMPLATE(Initialize, false);
  return 0;
}


int GpioArmNuttx::Release(GpioReqWrap* gpio_req) {
  GPIO_NUTTX_IMPL_TEMPLATE(Release, true);
  return 0;
}


int GpioArmNuttx::SetPin(GpioReqWrap* gpio_req) {
  GPIO_NUTTX_IMPL_TEMPLATE(SetPin, true);
  return 0;
}


int GpioArmNuttx::WritePin(GpioReqWrap* gpio_req) {
  GPIO_NUTTX_IMPL_TEMPLATE(WritePin, true);
  return 0;
}


int GpioArmNuttx::ReadPin(GpioReqWrap* gpio_req) {
  IOTJS_ASSERT(!"Not implemented");
  return 0;
}


} // namespace iotjs

#endif // __NUTTX__
