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
import { onHttpRequest } from './cdt-proxy-http';

export interface ChromeDevToolsProxyServerOptions {
  port?: number;
  host?: string;
  uuid?: string;
  jsfile?: string;
}

export const DEFAULT_SERVER_HOST = '127.0.0.1';
export const DEFAULT_SERVER_PORT = 9229;
export const JERRY_DEBUGGER_VERSION = 'jerry-debugger/v0.0.1';
export const DEVTOOLS_PROTOCOL_VERSION = '1.1';

export class ChromeDevToolsProxyServer {
  readonly host: string;
  readonly port: number;
  readonly uuid: string;
  readonly jsfile: string;
  asyncCallStackDepth: number;
  pauseOnExceptions: string;

  constructor(options: ChromeDevToolsProxyServerOptions) {
    const server = http.createServer();

    this.host = options.host || DEFAULT_SERVER_HOST;
    this.port = options.port || DEFAULT_SERVER_PORT;
    this.uuid = options.uuid || uuid();
    // FIXME: probably not quite right, can include ../.. etc.
    this.jsfile = options.jsfile || 'untitled.js';
    this.asyncCallStackDepth = 0;  // 0 is unlimited
    this.pauseOnExceptions = 'none';

    server.listen(this.port);

    const wss = new WebSocketServer({ server });
    const rpcServer = new rpc.Server(wss);
    const api: Crdp.CrdpServer = rpcServer.api();

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

    // QUESTION: is there a better way to do this?
    const proxy = this;

    api.Debugger.expose({
      enable: notImplemented,
      setBlackboxPatterns: notImplemented,
      async setAsyncCallStackDepth(params) {
        proxy.asyncCallStackDepth = params.maxDepth;
      },
      async setPauseOnExceptions(params) {
        proxy.pauseOnExceptions = params.state;
      },
    });
    api.Profiler.expose({ enable: notImplemented });
    api.Runtime.expose({
      enable: notImplemented,
      runIfWaitingForDebugger: notImplemented,
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
}
