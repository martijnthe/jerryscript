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

import Crdp from 'chrome-remote-debug-protocol';

import { Breakpoint } from './breakpoint';
import { JerryDebugProtocolHandler, JerryMessageScriptParsed, JerryMessageBreakpointHit,
  PossibleBreakpointsParams, FindBreakpointParams } from './protocol-handler';
import { ChromeDevToolsProxyServer } from './cdt-proxy';

export interface JerryDebuggerDelegate {
  onScriptParsed?(message: JerryMessageScriptParsed): void;
  onBreakpointHit?(message: JerryMessageBreakpointHit): void;
}

export class CDTController {
  // NOTE: protocolHandler must be set before methods are called
  public protocolHandler?: JerryDebugProtocolHandler;
  // NOTE: proxyServer must be set after debugger is connected, protocolHandler is
  //   set, and before issuing further commands to the debugger
  public proxyServer?: ChromeDevToolsProxyServer;
  private scripts: Array<JerryMessageScriptParsed> = [];
  private pendingBreakpoint?: Breakpoint;

  // FIXME: this lets test suite run for now
  unused() {
    Breakpoint;
  }

  // JerryDebuggerDelegate functions
  onError(code: number, message: string) {
    console.log(`Error: ${message} (${code})`);
  }

  onScriptParsed(message: JerryMessageScriptParsed) {
    this.scripts.push(message);
    // this can happen before the proxy is connected
    if (this.proxyServer) {
      this.proxyServer.scriptParsed(message);
    }
  }

  onBreakpointHit(message: JerryMessageBreakpointHit) {
    // this can happen before the proxy is connected
    if (this.proxyServer) {
      this.pendingBreakpoint = message.breakpoint;
      this.protocolHandler!.requestBacktrace();
    }
  }

  onBacktrace(backtrace: Array<Breakpoint>) {
    this.sendPaused(this.pendingBreakpoint, backtrace);
    this.pendingBreakpoint = undefined;
  }

  onResume() {
    this.proxyServer!.sendResumed();
  }

  // CDTDelegate functions

  // 'request' functions are information requests from CDT to Debugger
  requestScripts() {
    for (let i = 0; i < this.scripts.length; i++) {
      this.proxyServer!.scriptParsed(this.scripts[i]);
    }
  }

  requestBreakpoint() {
    const breakpoint = this.protocolHandler!.getLastBreakpoint();
    if (!breakpoint) {
      throw new Error('no last breakpoint found');
    }

    this.pendingBreakpoint = breakpoint;
    this.protocolHandler!.requestBacktrace();
  }

  requestPossibleBreakpoints(request: Crdp.Debugger.GetPossibleBreakpointsRequest) {
    // TODO: support restrictToFunction parameter
    const bpRequest: PossibleBreakpointsParams = {
      scriptId: Number(request.start.scriptId),
      startLine: request.start.lineNumber + 1,
    };
    if (request.end) {
      bpRequest.endLine = request.end.lineNumber + 1;
    }
    const possible = this.protocolHandler!.getPossibleBreakpoints(bpRequest);
    const array: Array<Crdp.Debugger.BreakLocation> = [];
    for (let i in possible) {
      const breakpoint = possible[i];
      const location: Crdp.Debugger.BreakLocation = {
        scriptId: request.start.scriptId,
        lineNumber: breakpoint.line - 1,
        columnNumber: 0,  // FIXME: ignoring columns for now
        type: 'debuggerStatement',  // TODO: may need to also use 'call' and 'return'
      };
      array.push(location);
    }

    return Promise.resolve({
      locations: array,
    });
  }

  requestScriptSource(request: Crdp.Debugger.GetScriptSourceRequest) {
    return Promise.resolve({
      scriptSource: this.protocolHandler!.getSource(Number(request.scriptId)),
    });
  }

  // 'cmd' functions are commands from CDT to Debugger
  cmdPause() {
    this.protocolHandler!.pause();
  }

  cmdRemoveBreakpoint(breakpointId: number) {
    const breakpoint = this.protocolHandler!.getActiveBreakpoint(breakpointId);
    if (!breakpoint) {
      throw new Error('no breakpoint found');
    }
    this.updateBreakpoint(breakpoint.scriptId, breakpoint.line, false);
    return Promise.resolve();
  }

  cmdResume() {
    this.protocolHandler!.resume();
  }

  cmdSetBreakpoint(request: Crdp.Debugger.SetBreakpointRequest) {
    const scriptId = Number(request.location.scriptId);
    const breakpointId = this.updateBreakpoint(scriptId, request.location.lineNumber + 1, true);
    const response: Crdp.Debugger.SetBreakpointResponse = {
      breakpointId: String(breakpointId),
      actualLocation: request.location,
    };
    return Promise.resolve(response);
  }

  cmdSetBreakpointByUrl(request: Crdp.Debugger.SetBreakpointByUrlRequest) {
    if (!request.url) {
      throw new Error('no url found');
    }

    const scriptId = this.protocolHandler!.getScriptIdByName(request.url);
    const breakpointId = this.updateBreakpoint(scriptId, request.lineNumber + 1, true);
    const response: Crdp.Debugger.SetBreakpointByUrlResponse = {
      breakpointId: String(breakpointId),
      locations: [{
        scriptId: String(scriptId),
        lineNumber: request.lineNumber,
        columnNumber: 0,  // TODO: use real column
      }],
    };
    return Promise.resolve(response);
  }

  cmdStepInto() {
    this.protocolHandler!.stepInto();
  }

  cmdStepOut() {
    this.protocolHandler!.stepOut();
  }

  cmdStepOver() {
    this.protocolHandler!.stepOver();
  }

  // 'report' functions are events from Debugger to CDT
  private sendPaused(breakpoint: Breakpoint | undefined, backtrace: Array<Breakpoint>) {
    // Node uses 'Break on start' but this is not allowable in crdp.d.ts
    const reason = breakpoint ? 'debugCommand' : 'other';
    this.proxyServer!.sendPaused(breakpoint, backtrace, reason);
  }

  /**
   * Enables or disables a breakpoint.
   *
   * @param scriptId 1-based script ID
   * @param line     1-based line number
   * @param enable   true to enable, false to disable
   */
  private updateBreakpoint(scriptId: number, line: number, enable: boolean) {
    const params: FindBreakpointParams = {
      scriptId: scriptId,
      line: line,
      column: 0,  // TODO: use column
    };
    const breakpoint = this.protocolHandler!.findBreakpoint(params);
    return this.protocolHandler!.updateBreakpoint({
      breakpoint,
      enable,
    });
  }
}
