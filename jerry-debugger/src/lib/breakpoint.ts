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

import { ParserStackFrame } from './parsed-source';

export interface BreakpointMap {
  [index: number]: Breakpoint;
}

export class ParsedFunction {
  readonly isFunc: boolean;
  readonly byteCodeCP: number;
  readonly line: number;
  readonly column: number;
  readonly name: string;
  readonly firstBreakpointLine: number;
  readonly firstBreakpointOffset: number;
  readonly lines: BreakpointMap = {};
  readonly offsets: BreakpointMap = {};
  source?: Array<string>;
  sourceName?: string;

  constructor(byteCodeCP: number, frame: ParserStackFrame) {
    this.isFunc = frame.isFunc;
    this.byteCodeCP = byteCodeCP;
    this.line = frame.line;
    this.column = frame.column;
    this.name = frame.name;
    this.firstBreakpointLine = frame.lines[0];
    this.firstBreakpointOffset = frame.offsets[0];

    for (let i = 0; i < frame.lines.length; i++) {
      const breakpoint = new Breakpoint({
        func: this,
        line: frame.lines[i],
        offset: frame.offsets[i],
        activeIndex: -1,
      });

      this.lines[breakpoint.line] = breakpoint;
      this.offsets[breakpoint.offset] = breakpoint;
    }
  }
}

export interface BreakpointOptions {
  func: ParsedFunction;
  line: number;
  offset: number;
  activeIndex?: number;
}

export class Breakpoint {
  readonly line: number = 1;
  readonly offset: any;
  readonly func: ParsedFunction;
  activeIndex: number = -1;

  constructor(options: BreakpointOptions) {
    this.func = options.func;
    this.line = options.line;
    this.offset = options.offset;
    if (options.activeIndex !== undefined) {
      this.activeIndex = options.activeIndex;
    }
  }

  toString() {
    let result = this.func.sourceName || '<unknown>';

    result += ':' + this.line;

    if (this.func.isFunc) {
      result += ' (in '
                + (this.func.name || 'function')
                + '() at line:'
                + this.func.line
                + ', col:'
                + this.func.column
                + ')';
    }

    return result;
  }
}
