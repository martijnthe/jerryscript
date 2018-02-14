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

export interface ChromeDevToolsProxyServerOptions extends WebSocket.ServerOptions {
}

export class ChromeDevToolsProxyServer {
  constructor(options: ChromeDevToolsProxyServerOptions) {
    const wss = new WebSocketServer(options);
    const rpcServer = new rpc.Server(wss);
    const api: Crdp.CrdpServer = rpcServer.api();

    wss.on('connection', function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      console.log(`connection from: ${ip}`);

      ws.on('message', function incoming(message) {
        console.log('received: %s', message);
      });
      ws.send('hello');
    });

    rpcServer.setLogging({
      logEmit: true,
      logConsole: true,
    });

      //
      // // Lifted from the example on https://github.com/nojvek/noice-json-rpc
    const enable = async () => {
      console.log('enable called!');
    };

    api.Debugger.expose({ enable });
    api.Runtime.expose({
      enable,
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
