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

import * as SP from './jrs-protocol-constants';
import { Breakpoint, ParsedFunction } from './breakpoint';
import { ByteConfig, cesu8ToString, assembleUint8Arrays, decodeMessage, encodeMessage } from './utils';
import { JerryDebuggerClient } from './debugger-client';

export type CompressedPointer = number;
export type ByteCodeOffset = number;

export interface ParserStackFrame {
  isFunc: boolean;
  scriptId: number;
  line: number;
  column: number;
  name: string;
  source: string;
  sourceName?: string;
  lines: Array<number>;
  offsets: Array<ByteCodeOffset>;
  byteCodeCP?: CompressedPointer;
  firstBreakpointLine?: number;
  firstBreakpointOffset?: ByteCodeOffset;
}

export interface JerryDebugProtocolDelegate {
  onError?(code: number, message: string): void;
  onBacktrace?(backtrace: Array<Breakpoint>): void;
  onBreakpointHit?(message: JerryMessageBreakpointHit): void;
  onResume?(): void;
  onScriptParsed?(message: JerryMessageScriptParsed): void;
}

export interface JerryMessageScriptParsed {
  id: number;
  name: string;
  lineCount: number;
}

export interface JerryMessageBreakpointHit {
  breakpoint: Breakpoint;
  exact: boolean;
}

export interface PossibleBreakpointsParams {
  scriptId: number;
  startLine: number;
  endLine?: number;
}

export interface FindBreakpointParams {
  scriptId: number;
  line: number;
  column?: number;
}

export interface UpdateBreakpointParams {
  breakpoint: Breakpoint;
  enable: boolean;
}

interface ProtocolFunctionMap {
  [type: number]: (data: Uint8Array) => void;
}

interface FunctionMap {
  [cp: string]: ParsedFunction;
}

interface LineFunctionMap {
  // maps line number to an array of functions
  [line: number]: Array<ParsedFunction>;
}

interface ParsedSource {
  name?: string;
  source?: string;
}

// abstracts away the details of the protocol
export class JerryDebugProtocolHandler {
  public debuggerClient?: JerryDebuggerClient;
  private delegate: JerryDebugProtocolDelegate;

  // debugger configuration
  private maxMessageSize: number = 0;
  private byteConfig: ByteConfig;
  private version: number = 0;
  private functionMap: ProtocolFunctionMap;

  private stack: Array<ParserStackFrame> = [];
  private sources: Array<ParsedSource> = [{}];
  private lineLists: Array<LineFunctionMap> = [[]];
  private source: string = '';
  private sourceData?: Uint8Array;
  private sourceName?: string;
  private sourceNameData?: Uint8Array;
  private functionName?: string;
  private functionNameData?: Uint8Array;
  private functions: FunctionMap = {};
  private newFunctions: FunctionMap = {};
  private backtrace: Array<Breakpoint> = [];

  private nextScriptID: number = 1;
  private exceptionData?: Uint8Array;
  private lastBreakpointHit?: Breakpoint;
  private lastBreakpointExact: boolean = true;
  private activeBreakpoints: Array<Breakpoint> = [];
  private nextBreakpointIndex: number = 0;

  constructor(delegate: JerryDebugProtocolDelegate) {
    this.delegate = delegate;

    this.byteConfig = {
      cpointerSize: 0,
      littleEndian: true,
    };

    this.functionMap = {
      [SP.JERRY_DEBUGGER_CONFIGURATION]: this.onConfiguration,
      [SP.JERRY_DEBUGGER_BYTE_CODE_CP]: this.onByteCodeCP,
      [SP.JERRY_DEBUGGER_PARSE_FUNCTION]: this.onParseFunction,
      [SP.JERRY_DEBUGGER_BREAKPOINT_LIST]: this.onBreakpointList,
      [SP.JERRY_DEBUGGER_BREAKPOINT_OFFSET_LIST]: this.onBreakpointList,
      [SP.JERRY_DEBUGGER_SOURCE_CODE]: this.onSourceCode,
      [SP.JERRY_DEBUGGER_SOURCE_CODE_END]: this.onSourceCode,
      [SP.JERRY_DEBUGGER_SOURCE_CODE_NAME]: this.onSourceCodeName,
      [SP.JERRY_DEBUGGER_SOURCE_CODE_NAME_END]: this.onSourceCodeName,
      [SP.JERRY_DEBUGGER_FUNCTION_NAME]: this.onFunctionName,
      [SP.JERRY_DEBUGGER_FUNCTION_NAME_END]: this.onFunctionName,
      [SP.JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP]: this.onReleaseByteCodeCP,
      [SP.JERRY_DEBUGGER_BREAKPOINT_HIT]: this.onBreakpointHit,
      [SP.JERRY_DEBUGGER_BACKTRACE]: this.onBacktrace,
      [SP.JERRY_DEBUGGER_BACKTRACE_END]: this.onBacktrace,
    };
  }

  // FIXME: this lets test suite run for now
  unused() {
    this.maxMessageSize,
    this.lastBreakpointExact;
  }

  stepOver() {
    this.resumeExec(SP.JERRY_DEBUGGER_NEXT);
  }

  stepInto() {
    this.resumeExec(SP.JERRY_DEBUGGER_STEP);
  }

  stepOut() {
    console.log('step out not yet supported in JerryScript');
  }

  pause() {
    if (this.lastBreakpointHit) {
      throw new Error('attempted pause while at breakpoint');
    }
    this.debuggerClient!.send(encodeMessage(this.byteConfig, 'B', [SP.JERRY_DEBUGGER_STOP]));
  }

  resume() {
    this.resumeExec(SP.JERRY_DEBUGGER_CONTINUE);
  }

  getPossibleBreakpoints(params: PossibleBreakpointsParams): Array<Breakpoint> {
    const array = [];
    const lineList = this.lineLists[params.scriptId];
    for (let line in lineList) {
      let linenum = Number(line);
      if (linenum >= params.startLine) {
        if (!params.endLine || linenum <= params.endLine) {
          for (let func of lineList[line]) {
            array.push(func.lines[line]);
          }
        }
      }
    }
    return array;
  }

  getSource(scriptId: number) {
    if (scriptId < this.sources.length) {
      return this.sources[scriptId].source || '';
    }
    return '';
  }

  decodeMessage(format: string, message: Uint8Array, offset: number) {
    return decodeMessage(this.byteConfig, format, message, offset);
  }

  onConfiguration(data: Uint8Array) {
    console.log('[Configuration]');
    if (data.length < 5) {
      this.abort('configuration message wrong size');
      return;
    }

    this.maxMessageSize = data[1];
    this.byteConfig.cpointerSize = data[2];
    this.byteConfig.littleEndian = Boolean(data[3]);
    this.version = data[4];

    if (this.byteConfig.cpointerSize !== 2 && this.byteConfig.cpointerSize !== 4) {
      this.abort('compressed pointer must be 2 or 4 bytes long');
    }

    if (this.version !== SP.JERRY_DEBUGGER_VERSION) {
      this.abort('incorrect target debugger version detected: ' + this.version
                 + ' expected: ' + SP.JERRY_DEBUGGER_VERSION);
    }
  }

  onByteCodeCP(data: Uint8Array) {
    console.log('[Byte Code CP]');
    const frame = this.stack.pop();
    if (!frame) {
      throw new Error('missing parser stack frame');
    }

    const byteCodeCP = this.decodeMessage('C', data, 1)[0];
    const func = new ParsedFunction(byteCodeCP, frame);

    this.newFunctions[byteCodeCP] = func;
    if (this.stack.length > 0) {
      return;
    }

    // FIXME: it seems like this is probably unnecessarily keeping the
    //   whole file's source to this point?
    func.source = this.source.split(/\n/);
    func.sourceName = this.sourceName;
    this.source = '';
    this.sourceName = undefined;

    const lineList: LineFunctionMap = {};
    for (let cp in this.newFunctions) {
      const func = this.newFunctions[cp];
      this.functions[cp] = func;

      for (let i in func.lines) {
        // map line numbers to functions for this source
        if (i in lineList) {
          lineList[i].push(func);
        } else {
          lineList[i] = [func];
        }
      }
    }
    this.lineLists.push(lineList);
    this.nextScriptID++;
    this.newFunctions = {};
  }

  onParseFunction(data: Uint8Array) {
    console.log('[Parse Function]');
    const position = this.decodeMessage('II', data, 1);
    this.stack.push({
      isFunc: true,
      scriptId: this.nextScriptID,
      line: position[0],
      column: position[1],
      name: this.functionName || '',
      source: this.source,
      sourceName: this.sourceName,
      lines: [],
      offsets: [],
    });
    this.functionName = undefined;
    return;
  }

  onBreakpointList(data: Uint8Array) {
    console.log('[Breakpoint List]');
    if (data.byteLength % 4 !== 1 || data.byteLength < 1 + 4) {
      throw new Error('unexpected breakpoint list message length');
    }

    let array: Array<number> = [];
    const stackFrame = this.stack[this.stack.length - 1];
    if (data[0] === SP.JERRY_DEBUGGER_BREAKPOINT_LIST) {
      array = stackFrame.lines;
    } else {
      array = stackFrame.offsets;
    }

    for (let i = 1; i < data.byteLength; i += 4) {
      array.push(this.decodeMessage('I', data, i)[0]);
    }
  }

  onSourceCode(data: Uint8Array) {
    console.log('[Source Code]');

    if (this.stack.length === 0) {
      this.stack = [{
        isFunc: false,
        scriptId: this.nextScriptID,
        line: 1,
        column: 1,
        name: '',
        source: '',
        lines: [],
        offsets: [],
      }];
    }

    this.sourceData = assembleUint8Arrays(this.sourceData, data);
    if (data[0] === SP.JERRY_DEBUGGER_SOURCE_CODE_END) {
      this.source = cesu8ToString(this.sourceData);
      this.sources[this.nextScriptID] = {
        name: this.sourceName,
        source: this.source,
      };
      this.sourceData = undefined;
      if (this.delegate.onScriptParsed) {
        this.delegate.onScriptParsed({
          'id': this.nextScriptID,
          'name': this.sourceName || '',
          'lineCount': this.source.split(/\n/).length,
        });
      }
    }
  }

  onSourceCodeName(data: Uint8Array) {
    console.log('[Source Code Name]');
    this.sourceNameData = assembleUint8Arrays(this.sourceNameData, data);
    if (data[0] === SP.JERRY_DEBUGGER_SOURCE_CODE_NAME_END) {
      this.sourceName = cesu8ToString(this.sourceNameData);
      this.sourceNameData = undefined;
      // TODO: test that this is completed before source and included in the
      //   onScriptParsed delegate function called in onSourceCode, or abort
    }
  }

  onFunctionName(data: Uint8Array) {
    console.log('[Function Name]', data);
    this.functionNameData = assembleUint8Arrays(this.functionNameData, data);
    if (data[0] === SP.JERRY_DEBUGGER_FUNCTION_NAME_END) {
      this.functionName = cesu8ToString(this.functionNameData);
      this.functionNameData = undefined;
    }
  }

  onReleaseByteCodeCP(data: Uint8Array) {
    console.log('[Release Byte Code CP]');

    // just patch up incoming message
    data[0] = SP.JERRY_DEBUGGER_FREE_BYTE_CODE_CP;
    this.debuggerClient!.send(data);
  }

  getBreakpoint(breakpointData: Array<number>) {
    const func = this.functions[breakpointData[0]];
    const offset = breakpointData[1];

    if (offset in func.offsets) {
      return {
        breakpoint: func.offsets[offset],
        exact: true,
      };
    }

    if (offset < func.firstBreakpointOffset) {
      return {
        breakpoint: func.offsets[func.firstBreakpointOffset],
        exact: true,
      };
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
      exact: false,
    };
  }

  onBreakpointHit(data: Uint8Array) {
    console.log('[Breakpoint Hit]');
    const breakpointData = this.decodeMessage('CI', data, 1);
    const breakpointRef = this.getBreakpoint(breakpointData);
    const breakpoint = breakpointRef.breakpoint;

    if (data[0] === SP.JERRY_DEBUGGER_EXCEPTION_HIT) {
      console.log('Exception throw detected');
      if (this.exceptionData) {
        console.log('Exception hint:', cesu8ToString(this.exceptionData));
        this.exceptionData = undefined;
      }
    }

    this.lastBreakpointHit = breakpoint;
    this.lastBreakpointExact = breakpointRef.exact;

    let breakpointInfo = '';
    if (breakpoint.activeIndex >= 0) {
      breakpointInfo = 'breakpoint:' + breakpoint.activeIndex + ' ';
    }

    const atAround = breakpointRef.exact ? 'at' : 'around';
    console.log(`Stopped ${atAround} ${breakpointInfo}${breakpoint}`);

    // TODO: handle exception case differently
    if (this.delegate.onBreakpointHit) {
      this.delegate.onBreakpointHit(breakpointRef);
    }
  }

  onBacktrace(message: Uint8Array) {
    for (let i = 1; i < message.byteLength; i += this.byteConfig.cpointerSize + 4) {
      const breakpointData = this.decodeMessage('CI', message, i);
      this.backtrace.push(this.getBreakpoint(breakpointData).breakpoint);
    }

    if (message[0] === SP.JERRY_DEBUGGER_BACKTRACE_END) {
      if (this.delegate.onBacktrace) {
        this.delegate.onBacktrace(this.backtrace);
      }
      this.backtrace = [];
    }
  }

  onMessage(message: Uint8Array) {
    if (message.byteLength < 1) {
      this.abort('message too short');
      return;
    }

    if (this.byteConfig.cpointerSize === 0) {
      if (message[0] !== SP.JERRY_DEBUGGER_CONFIGURATION) {
        this.abort('the first message must be configuration');
        return;
      }
    }

    const handler = this.functionMap[message[0]];
    if (handler) {
      handler.call(this, message);
    } else {
      this.abort('unhandled protocol message type: ' + message[0]);
    }
  }

  getLastBreakpoint() {
    return this.lastBreakpointHit;
  }

  getScriptIdByName(name: string) {
    // skip the first (dummy) source
    for (let i = 1; i < this.sources.length; i++) {
      const source: ParsedSource = this.sources[i];
      if (name === source.name) {
        return i;
      }
    }
    throw new Error('no such source');
  }

  getActiveBreakpoint(breakpointId: number) {
    return this.activeBreakpoints[breakpointId];
  }

  findBreakpoint(params: FindBreakpointParams) {
    if (params.scriptId <= 0 || params.scriptId >= this.lineLists.length) {
      throw new Error('invalid script id');
    }
    const lineList = this.lineLists[params.scriptId];
    if (!lineList[params.line]) {
      throw new Error('no breakpoint found for line: ' + params.line);
    }
    for (let func of lineList[params.line]) {
      const breakpoint = func.lines[params.line];
      // TODO: when we start handling columns we would need to distinguish them
      return breakpoint;
    }
    throw new Error('no breakpoint found');
  }

  updateBreakpoint(params: UpdateBreakpointParams) {
    const breakpoint = params.breakpoint;
    let breakpointId;
    if (params.enable) {
      if (breakpoint.activeIndex !== -1) {
        throw new Error('breakpoint already enabled');
      }
      breakpointId = breakpoint.activeIndex = this.nextBreakpointIndex++;
      this.activeBreakpoints[breakpointId] = breakpoint;
    } else {
      if (breakpoint.activeIndex === -1) {
        throw new Error('breakpoint already disabled');
      }
      breakpointId = breakpoint.activeIndex;
      delete this.activeBreakpoints[breakpointId];
      breakpoint.activeIndex = -1;
    }
    this.debuggerClient!.send(encodeMessage(this.byteConfig, 'BBCI', [
      SP.JERRY_DEBUGGER_UPDATE_BREAKPOINT,
      Number(params.enable),
      params.breakpoint.func.byteCodeCP,
      params.breakpoint.offset,
    ]));
    return breakpointId;
  }

  requestBacktrace() {
    if (!this.lastBreakpointHit) {
      throw new Error('backtrace not allowed while app running');
    }
    this.debuggerClient!.send(encodeMessage(this.byteConfig, 'BI', [SP.JERRY_DEBUGGER_GET_BACKTRACE, 0]));
  }

  private abort(message: string) {
    if (this.delegate.onError) {
      console.log('Abort:', message);
      this.delegate.onError(0, message);
    }
  }

  private resumeExec(code: number) {
    if (!this.lastBreakpointHit) {
      throw new Error('attempted resume while not at breakpoint');
    }
    this.lastBreakpointHit = undefined;
    this.debuggerClient!.send(encodeMessage(this.byteConfig, 'B', [code]));
    if (this.delegate.onResume) {
      this.delegate.onResume();
    }
  }
}
