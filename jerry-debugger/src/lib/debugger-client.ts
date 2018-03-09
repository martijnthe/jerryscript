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

import WebSocket from 'ws';

import { JerryDebugProtocolHandler, JerryMessageScriptParsed } from './protocol-handler';

export interface JerryDebuggerOptions {
  host?: string;
  port?: number;
  verbose?: boolean;
}

export const DEFAULT_DEBUGGER_HOST = 'localhost';
export const DEFAULT_DEBUGGER_PORT = 5001;

export class JerryDebuggerClient {
  readonly host: string;
  readonly port: number;
  readonly verbose: boolean;
  private protocolHandler: JerryDebugProtocolHandler;
  private socket?: WebSocket;
  private connectPromise?: Promise<void>;
  private scripts: Array<JerryMessageScriptParsed> = [];

  constructor(options: JerryDebuggerOptions) {
    this.host = options.host || DEFAULT_DEBUGGER_HOST;
    this.port = options.port || DEFAULT_DEBUGGER_PORT;
    this.verbose = options.verbose || false;
    this.protocolHandler = new JerryDebugProtocolHandler(this);
  }

  connect(): Promise<void> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.socket = new WebSocket(`ws://${this.host}:${this.port}/jerry-debugger`);
    this.socket.binaryType = 'arraybuffer';
    this.socket.on('message', this.onMessage.bind(this));

    this.connectPromise = new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('socket missing'));
        return;
      }

      this.socket.on('open', () => {
        resolve();
      });

      this.socket.on('error', (err) => {
        reject(err);
      });
    });

    return this.connectPromise;
  }

  disconnect() {
    if (this.socket) {
      this.socket.terminate();
      this.socket = undefined;
    }
  }

  onMessage(data: ArrayBuffer) {
    this.protocolHandler.parseData(data);
  }

  onError(message: string) {
    console.log('Error:', message);
  }

  onScriptParsed(message: JerryMessageScriptParsed) {
    this.scripts.push(message);
  }

  getScripts() {
    return this.scripts;
  }
}
