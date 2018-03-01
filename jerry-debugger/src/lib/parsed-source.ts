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

import { PROTOCOL } from './jrs-protocol-constants';
import { cesu8ToString, concatUint8Arrays } from './string-utils';
import { JerryDebuggerClient } from './debugger-client';
import { ParsedFunction } from './breakpoint';
import { EventEmitter } from 'events';

export interface ParserStackFrame {
  isFunc: boolean;
  line: number;
  column: number;
  name: string;
  source: string;
  sourceName?: string;
  lines: Array<number>;
  offsets: Array<number>;
  byteCodeCP?: number;
  firstBreakpointLine?: number;
  firstBreakpointOffset?: number;
}

export interface FunctionMap {
  [cp: string]: ParsedFunction;
}

export class ParsedSource extends EventEmitter {
  private debugClient: JerryDebuggerClient;
  private stack: Array<ParserStackFrame>;
  private source: string = '';
  private sourceData?: Uint8Array;
  private sourceName?: string;
  private sourceNameData?: Uint8Array;
  private functionName?: Uint8Array;
  private functions: FunctionMap = {};
  private lastScriptID: number = 0;

  constructor(debugClient: JerryDebuggerClient) {
    super();

    this.debugClient = debugClient;
    this.stack = [{
      isFunc: false,
      line: 1,
      column: 1,
      name: '',
      source: '',
      lines: [],
      offsets: [],
    }];
  }

  eventNames() {
    return super.eventNames().concat(['scriptParsed']);
  }

  receive(message: Uint8Array) {
    const S = PROTOCOL.SERVER;

    switch (message[0]) {
      case S.JERRY_DEBUGGER_SOURCE_CODE:
      case S.JERRY_DEBUGGER_SOURCE_CODE_END:
        console.log('[Source Code]');
        this.sourceData = concatUint8Arrays(this.sourceData, message);
        if (message[0] === S.JERRY_DEBUGGER_SOURCE_CODE_END) {
          this.source = cesu8ToString(this.sourceData);
          this.emit('scriptParsed', {
            'scriptId': ++this.lastScriptID,
            'name': this.sourceName,
            'endLine': this.source.split(/\r\n[\r\n]/).length,
            'endColumn': 0,
            'hasSourceURL': false,
          })
        }
        return;

      case S.JERRY_DEBUGGER_SOURCE_CODE_NAME:
      case S.JERRY_DEBUGGER_SOURCE_CODE_NAME_END:
        console.log('[Source Code Name]');
        this.sourceNameData = concatUint8Arrays(this.sourceNameData, message);
        if (message[0] === S.JERRY_DEBUGGER_SOURCE_CODE_NAME_END) {
          this.sourceName = cesu8ToString(this.sourceNameData);
        }
        return;

      case S.JERRY_DEBUGGER_FUNCTION_NAME:
      case S.JERRY_DEBUGGER_FUNCTION_NAME_END:
        console.log('[Function Name]');
        this.functionName = concatUint8Arrays(this.functionName, message);
        return;

      case S.JERRY_DEBUGGER_PARSE_FUNCTION: {
        console.log('[Parse Function]');

        const position = this.debugClient.decodeMessage('II', message, 1);
        this.stack.push({
          isFunc: true,
          line: position[0],
          column: position[1],
          name: cesu8ToString(this.functionName),
          source: this.source,
          sourceName: this.sourceName,
          lines: [],
          offsets: [],
        });
        this.functionName = undefined;
        return;
      }

      case S.JERRY_DEBUGGER_BREAKPOINT_LIST:
      case S.JERRY_DEBUGGER_BREAKPOINT_OFFSET_LIST:
        console.log('[Breakpoint List]');
        if (message.byteLength % 4 != 1 || message.byteLength < 1 + 4) {
          throw new Error('unexpected breakpoint list message length');
        }

        let array: Array<number>;
        if (message[0] === S.JERRY_DEBUGGER_BREAKPOINT_LIST) {
          array = this.stack[this.stack.length - 1].lines;
        }
        else {
          array = this.stack[this.stack.length - 1].offsets;
        }

        for (let i = 1; i < message.byteLength; i += 4) {
          array.push(this.debugClient.decodeMessage('I', message, i)[0]);
        }
        return;

      case S.JERRY_DEBUGGER_BYTE_CODE_CP:
        console.log('[Byte Code CP]');
        const frame = this.stack.pop();
        if (!frame) {
          throw new Error('missing parser stack frame');
        }

        const byteCodeCP = this.debugClient.decodeMessage('C', message, 1)[0];
        const func = new ParsedFunction(byteCodeCP, frame);

        this.functions[byteCodeCP] = func;
        if (this.stack.length > 0) {
          return;
        }

        // FIXME: it seems like this is probably unnecessarily keeping the
        //   whole file's source to this point?
        func.source = this.source.split(/\r\n[\r\n]/);
        func.sourceName = this.sourceName;
        break;

      default:
        console.log('[OTHER RECEIVE]', message[0]);
        return;
    }

    for (let cp in this.functions) {
      const func = this.functions[cp];
      this.debugClient.functions[cp] = func;

      /* TODO: implement lineList for setBreakpoint
      for (let i in func.lines) {
      }
      */
    }
  }
}
