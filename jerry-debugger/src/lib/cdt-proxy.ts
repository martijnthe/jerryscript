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

import * as WebSocket from 'ws';
import WebSocketServer = WebSocket.Server;
import * as rpc from 'noice-json-rpc';
import Crdp from 'chrome-remote-debug-protocol';
import * as http from 'http';
import uuid from 'uuid/v1';

import { Breakpoint } from './breakpoint';
import { onHttpRequest } from './cdt-proxy-http';
import { JerryMessageBreakpointHit, JerryMessageScriptParsed } from './protocol-handler';

export interface CDTDelegate {
  requestScripts: () => void;
  requestBreakpoint: () => void;
  getScriptSource: (request: Crdp.Debugger.GetScriptSourceRequest) => Promise<Crdp.Debugger.GetScriptSourceResponse>;
}

export interface ChromeDevToolsProxyServerOptions {
  delegate: CDTDelegate;
  port?: number;
  host?: string;
  uuid?: string;
  jsfile?: string;
}

export const DEFAULT_SERVER_HOST = 'localhost';
export const DEFAULT_SERVER_PORT = 9229;
export const JERRY_DEBUGGER_VERSION = 'jerry-debugger/v0.0.1';
export const DEVTOOLS_PROTOCOL_VERSION = '1.1';

export class ChromeDevToolsProxyServer {
  readonly host: string;
  readonly port: number;
  readonly uuid: string;
  readonly jsfile: string;
  private asyncCallStackDepth: number = 0;  // 0 is unlimited
  private pauseOnExceptions: ('none' | 'uncaught' | 'all') = 'none';
  private delegate: CDTDelegate;
  private api: Crdp.CrdpServer;

  constructor(options: ChromeDevToolsProxyServerOptions) {
    this.delegate = options.delegate;

    const server = http.createServer();

    this.host = options.host || DEFAULT_SERVER_HOST;
    this.port = options.port || DEFAULT_SERVER_PORT;
    this.uuid = options.uuid || uuid();
    // FIXME: probably not quite right, can include ../.. etc.
    this.jsfile = options.jsfile || 'untitled.js';

    () => {
      // FIXME: pretend to use these to get around lint error for now
      this.asyncCallStackDepth, this.pauseOnExceptions;
    };

    server.listen(this.port);

    const wss = new WebSocketServer({ server });
    const rpcServer = new rpc.Server(wss);
    this.api = rpcServer.api();

    wss.on('connection', function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      console.log(`connection from: ${ip}`);
    });

    server.on('request', onHttpRequest.bind(this));

    rpcServer.setLogging({
      logEmit: true,
      logConsole: true,
    });

    // Based on the example from https://github.com/nojvek/noice-json-rpc
    const notImplemented = async () => {
      console.log('Function not implemented');
    };

    this.api.Debugger.expose({
      enable: notImplemented,
      setBlackboxPatterns: notImplemented,
      getScriptSource: request => this.delegate.getScriptSource(request),
      setPauseOnExceptions: async (params) => {
        this.pauseOnExceptions = params.state;
      },
      setAsyncCallStackDepth: async (params) => {
        this.asyncCallStackDepth = params.maxDepth;
      },
    });
    this.api.Profiler.expose({ enable: notImplemented });
    this.api.Runtime.expose({
      enable: notImplemented,
      runIfWaitingForDebugger: async () => {
        // how could i chain this to happen after the enable response goes out?
        this.api.Runtime.emitExecutionContextCreated({
          context: {
            // might need to track multiple someday
            id: 1,
            origin: '',
            // node seems to use node[<PID>] FWIW
            name: 'jerryscript',
          },
        });

        // request controller to send scriptParsed command for existing scripts
        this.delegate.requestScripts();
        this.delegate.requestBreakpoint();
      },
      async runScript() {
        console.log('runScript called!');
        return {
          // Return a bogus result
          result: {
            type: 'boolean',
            value: true,
          },
        };
      },
    });
  }

  scriptParsed(script: JerryMessageScriptParsed) {
    this.api.Debugger.emitScriptParsed({
      scriptId: String(script.id),
      url: script.name,
      startLine: 0,
      startColumn: 0,
      endLine: script.lineCount,
      endColumn: 0,
      executionContextId: 1,
      hash: '',
    });
  }

  /*
   * sends Debugger.paused event for the current debugger location
   */
  sendPaused(breakpoint: Breakpoint, reason: 'exception' | 'other') {
    const callFrame: Crdp.Debugger.CallFrame = {
      callFrameId: '0',  // FIXME
      functionName: '',  // FIXME
      location: {
        scriptId: '1',  // TODO: will we always have just one script?
        lineNumber: breakpoint.line - 1,  // switch to 0-based
      },
      scopeChain: [],
      this: {
        type: 'object',
      },
    };
    this.api.Debugger.emitPaused({
      hitBreakpoints: [],
      reason,
      callFrames: [callFrame],
    });
  }

  breakpointHit(message: JerryMessageBreakpointHit) {
    console.log('NOT YET IMPLEMENTED');
  }
}
