// Copyright JS Foundation and other contributors, http://js.foundation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import assert from 'assert';
import WebSocket from 'ws';

import { Breakpoint, ParsedFunction } from './breakpoint';
import { PROTOCOL } from './jrs-protocol-constants';
import { FunctionMap, ParsedSource } from './parsed-source';
import { cesu8ToString } from './string-utils';

export interface JerryDebuggerOptions {
  host?: string;
  port?: number;
  verbose?: boolean;
}

export const DEFAULT_DEBUGGER_HOST = 'localhost';
export const DEFAULT_DEBUGGER_PORT = 5001;

// expected JerryScript debugger protocol version
const JERRY_DEBUGGER_VERSION = 1;

export class JerryDebuggerClient {
  readonly host: string;
  readonly port: number;
  readonly verbose: boolean;
  private socket?: WebSocket;

  // debugger configuration
  private maxMessageSize: number = 0;
  private cpointerSize: number = 0;
  private littleEndian: boolean = true;
  private version: number = 0;
  private parseObj?: ParsedSource;
  private outputResult?: Uint8Array;
  private exceptionData?: Uint8Array;
  private lastBreakpointHit?: object;
  private backtraceFrame: number = 0;
  functions: FunctionMap = {};

  constructor(options: JerryDebuggerOptions) {
    this.host = options.host || DEFAULT_DEBUGGER_HOST;
    this.port = options.port || DEFAULT_DEBUGGER_PORT;
    this.verbose = options.verbose || false;
  }

  connect() {
    if (this.socket) {
      return Promise.resolve();
    }
    this.socket = new WebSocket(`ws://${this.host}:${this.port}/jerry-debugger`);
    this.socket.binaryType = 'arraybuffer';
    this.socket.on('message', this.onMessage.bind(this));

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject();
        return;
      }

      this.socket.on('open', () => {
        resolve();
      });

      this.socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.terminate();
      this.socket = undefined;
    }
  }

  abortConnection(message: string) {
    this.disconnect();
    console.log('Abort connection: ' + message);
    throw new Error(message);
  }

  getFormatSize(format: string) {
    let length = 0;
    for (let i = 0; i < format.length; i++) {
      switch (format[i]) {
        case 'B':
          length++;
          break;

        case 'C':
          length += this.cpointerSize;
          break;

        case 'I':
          length += 4;
          break;

        default:
          throw new Error('unsupported message format');
      }
    }
    return length;
  }

  decodeMessage(format: string, message: Uint8Array, offset = 0) {
    // Format: B=byte I=int32 C=cpointer
    // Returns an array of decoded numbers

    const result = [];
    let value;

    if (offset + this.getFormatSize(format) > message.byteLength) {
      this.abortConnection('received message too short');
    }

    for (let i = 0; i < format.length; i++) {
      if (format[i] === 'B') {
        result.push(message[offset]);
        offset++;
        continue;
      }

      if (format[i] === 'C' && this.cpointerSize === 2) {
        if (this.littleEndian) {
          value = message[offset] | (message[offset + 1] << 8);
        } else {
          value = (message[offset] << 8) | message[offset + 1];
        }

        result.push(value);
        offset += 2;
        continue;
      }

      assert(format[i] === 'I' || (format[i] === 'C' && this.cpointerSize === 4));

      if (this.littleEndian) {
        value = (message[offset] | (message[offset + 1] << 8)
                 | (message[offset + 2] << 16) | (message[offset + 3] << 24));
      } else {
        value = ((message[offset] << 24) | (message[offset + 1] << 16)
                 | (message[offset + 2] << 8) | message[offset + 3] << 24);
      }

      result.push(value);
      offset += 4;
    }

    return result;
  }

  releaseFunction(message: Uint8Array) {
  }

  getBreakpoint(breakpointData: Array<number>) {
    const func = this.functions[breakpointData[0]];
    const offset = breakpointData[1];

    if (offset in func.offsets) {
      return {
        breakpoint: func.offsets[offset],
        at: true,
      }
    }

    if (offset < func.firstBreakpointOffset) {
      return {
        breakpoint: func.offsets[func.firstBreakpointOffset],
        at: true,
      }
    }

    let nearestOffset = -1;
    for (let currentOffset in func.offsets) {
      const current = Number(currentOffset);
      if ((current <= offset) && (current > nearestOffset)) {
        nearestOffset = current;
      }
    }

    return {
      breakpoint: func.offsets[nearestOffset],
      at: false,
    };
  }

  onMessage(data: ArrayBuffer) {
    const S = PROTOCOL.SERVER;
    const message = new Uint8Array(data);

    if (message.byteLength < 1) {
      this.abortConnection('message too short');
    }

    if (this.cpointerSize === 0) {
      if (message[0] !== S.JERRY_DEBUGGER_CONFIGURATION || message.byteLength !== 5) {
        this.abortConnection('the first message must be configuration');
      }

      this.maxMessageSize = message[1];
      this.cpointerSize = message[2];
      this.littleEndian = Boolean(message[3]);

      this.version = message[4];

      if (this.cpointerSize !== 2 && this.cpointerSize !== 4) {
        this.abortConnection('compressed pointer must be 2 or 4 bytes long');
      }

      if (this.version !== JERRY_DEBUGGER_VERSION) {
        this.abortConnection('incorrect target debugger version detected: ' + this.version
                             + ' expected: ' + JERRY_DEBUGGER_VERSION);
      }

      return;
    }

    switch (message[0]) {
      case S.JERRY_DEBUGGER_PARSE_ERROR:
        console.log('[Parse Error]');
        console.log('debugger parse error');
        this.parseObj = undefined;
        return;

      case S.JERRY_DEBUGGER_BYTE_CODE_CP:
      case S.JERRY_DEBUGGER_PARSE_FUNCTION:
      case S.JERRY_DEBUGGER_BREAKPOINT_LIST:
      case S.JERRY_DEBUGGER_BREAKPOINT_OFFSET_LIST:
      case S.JERRY_DEBUGGER_SOURCE_CODE:
      case S.JERRY_DEBUGGER_SOURCE_CODE_END:
      case S.JERRY_DEBUGGER_SOURCE_CODE_NAME:
      case S.JERRY_DEBUGGER_SOURCE_CODE_NAME_END:
      case S.JERRY_DEBUGGER_FUNCTION_NAME:
      case S.JERRY_DEBUGGER_FUNCTION_NAME_END:
        if (!this.parseObj) {
          this.parseObj = new ParsedSource(this);
        }
        this.parseObj.receive(message);
        return;

      case S.JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP:
        console.log('[Byte Code CP]');
        this.releaseFunction(message);
        return;

      case S.JERRY_DEBUGGER_MEMSTATS_RECEIVE: {
        console.log('[Mem Stats]');
        const messagedata = this.decodeMessage('IIIII', message, 1);

        console.log('Allocated bytes: ' + messagedata[0]);
        console.log('Byte code bytes: ' + messagedata[1]);
        console.log('String bytes: ' + messagedata[2]);
        console.log('Object bytes: ' + messagedata[3]);
        console.log('Property bytes: ' + messagedata[4]);
        return;
      }

      case S.JERRY_DEBUGGER_BREAKPOINT_HIT:
      case S.JERRY_DEBUGGER_EXCEPTION_HIT: {
        console.log('[Breakpoint Hit]');
        var breakpointData = this.decodeMessage('CI', message, 1);
        var breakpointRef = this.getBreakpoint(breakpointData);
        var breakpoint = breakpointRef.breakpoint;

        if (message[0] == S.JERRY_DEBUGGER_EXCEPTION_HIT) {
          console.log('Exception throw detected');
          if (this.exceptionData) {
            console.log('Exception hint: ' + cesu8ToString(this.exceptionData));
            this.exceptionData = undefined;
          }
        }

        this.lastBreakpointHit = breakpoint;

        var breakpointInfo = '';
        if (breakpoint.activeIndex >= 0) {
          breakpointInfo = ' breakpoint:' + breakpoint.activeIndex + ' ';
        }

        console.log('Stopped '
                  + (breakpointRef.at ? 'at ' : 'around ')
                  + breakpointInfo
                  + breakpoint);
        return;
      }
/*
      case S.JERRY_DEBUGGER_EXCEPTION_STR:
      case S.JERRY_DEBUGGER_EXCEPTION_STR_END: {
        this.exceptionData = concatUint8Arrays(this.exceptionData, message);
        return;
      }

      case S.JERRY_DEBUGGER_BACKTRACE:
      case S.JERRY_DEBUGGER_BACKTRACE_END: {
        for (var i = 1; i < message.byteLength; i += this.cpointerSize + 4) {
          var breakpointData = this.decodeMessage('CI', message, i);

          breakpoint = this.getBreakpoint(breakpointData).breakpoint;

          console.log('  frame '
                    + this.backtraceFrame
                    + ': '
                    + this.breakpointToString(breakpoint));

          ++this.backtraceFrame;
        }

        if (message[0] == S.JERRY_DEBUGGER_BACKTRACE_END) {
          this.backtraceFrame = 0;
        }
        return;
      }

      case S.JERRY_DEBUGGER_EVAL_RESULT:
      case S.JERRY_DEBUGGER_EVAL_RESULT_END: {

        evalResult = concatUint8Arrays(evalResult, message);
        var subType = evalResult[evalResult.length - 1];
        evalResult = evalResult.slice(0, -1);
        if (subType == JERRY_DEBUGGER_EVAL_OK)
        {
          console.log(cesu8ToString(evalResult));
          evalResult = null;
          return;
        }

        if (subType == JERRY_DEBUGGER_EVAL_ERROR)
        {
          console.log('Uncaught exception: ' + cesu8ToString(evalResult));
          evalResult = null;
          return;
        }

        return;
      }

      case S.JERRY_DEBUGGER_OUTPUT_RESULT:
      case S.JERRY_DEBUGGER_OUTPUT_RESULT_END: {
        outputResult = concatUint8Arrays(outputResult, message);

        if (message[0] == JERRY_DEBUGGER_OUTPUT_RESULT_END)
        {
          var subType = outputResult[outputResult.length - 1];
          var outString;
          outputResult = outputResult.slice(0, -1);

          switch (subType)
          {
            case S.JERRY_DEBUGGER_OUTPUT_OK:
            case S.JERRY_DEBUGGER_OUTPUT_DEBUG:
              outString = 'out: ' + cesu8ToString(outputResult);
              break;
            case S.JERRY_DEBUGGER_OUTPUT_WARNING:
              outString = 'warning: ' + cesu8ToString(outputResult);
              break;
            case S.JERRY_DEBUGGER_OUTPUT_ERROR:
              outString = 'err: ' + cesu8ToString(outputResult);
              break;
            case S.JERRY_DEBUGGER_OUTPUT_TRACE:
              outString = 'trace: ' + cesu8ToString(outputResult);
              break;
          }

          console.log(outString);
          this.outputResult = undefined;
        }

        return;
      }

      case S.JERRY_DEBUGGER_WAIT_FOR_SOURCE:
      {
        // This message does not have effect in this client.
        return;
      }
*/
      default: {
        console.log('[UNHANDLED MSG] length', message.length);
        let str = '';
        for (let i = 0; i < message.length; i++) {
          str += message[i] + ', ';
        }
        console.log(str);

//        this.abortConnection('unexpected message');
        return;
      }
    }
  }
}
