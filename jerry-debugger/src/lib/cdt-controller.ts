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

import { Breakpoint } from './breakpoint';
import { JerryDebugProtocolHandler, JerryMessageScriptParsed, JerryMessageBreakpointHit } from './protocol-handler';
import { ChromeDevToolsProxyServer } from './cdt-proxy';

export interface JerryDebuggerDelegate {
  onScriptParsed?(message: JerryMessageScriptParsed): void;
  onBreakpointHit?(message: JerryMessageBreakpointHit): void;
};

export class CDTController {
  private protocolHandler?: JerryDebugProtocolHandler;
  private proxyServer?: ChromeDevToolsProxyServer;
  private scripts: Array<JerryMessageScriptParsed> = [];

  constructor() {
  }

  setProtocolHandler(handler: JerryDebugProtocolHandler) {
    this.protocolHandler = handler;
  }

  setProxyServer(server: ChromeDevToolsProxyServer) {
    this.proxyServer = server;
  }

  // JerryDebuggerDelegate functions
  onError(message: string) {
    console.log('Error:', message);
  }

  onScriptParsed(message: JerryMessageScriptParsed) {
    this.scripts.push(message);
    if (this.proxyServer) {
      this.proxyServer.scriptParsed(message);
    }
  }

  onBreakpointHit(message: JerryMessageBreakpointHit) {
    if (this.proxyServer) {
      this.proxyServer.breakpointHit(message);
    }
  }

  // CDTDelegate functions
  requestScripts() {
    if (!this.proxyServer) {
      throw new Error('missing proxy server');
    }
    for (let i = 0; i < this.scripts.length; i++) {
      this.proxyServer.scriptParsed(this.scripts[i]);
    }
  }

  requestBreakpoint() {
    if (!this.protocolHandler) {
      throw new Error('missing protocol handler');
    }
    const breakpoint = this.protocolHandler.getLastBreakpoint();
    // Node uses 'Break on start' but this is not allowable in crdp.d.ts
    this.proxyServer.sendPaused('other');
  }
}
