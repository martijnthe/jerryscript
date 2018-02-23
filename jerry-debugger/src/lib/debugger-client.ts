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

export class JerryDebugger {
  readonly host: string;
  readonly port: number;
  private _socket: WebSocket | undefined = undefined;
  private _connectPromise: Promise<void>;

  constructor(address: string) {
    // NOTE: It seems pretty clean to keep the defaults hidden within the class like this.
    // This was how the .py version did it, maybe I should do this for proxy too?
    const hostAndPort = address.split(':');
    this.host = hostAndPort[0] || 'localhost';
    this.port = parseInt(hostAndPort[1], 10) || 5001;

    this._connectPromise = new Promise((resolve, reject) => {
      this._socket = new WebSocket(`ws://${this.host}:${this.port}/jerry-debugger`);
      this._socket.binaryType = 'arraybuffer';

      this._socket.on('open', () => {
        resolve();
      });

      this._socket.on('error', () => {
        reject();
      });
    });
  }

  getConnectPromise(): Promise<void> {
    return this._connectPromise;
  }
}
