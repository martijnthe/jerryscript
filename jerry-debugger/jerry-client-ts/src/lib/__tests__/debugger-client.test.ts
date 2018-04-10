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

import { JerryDebuggerClient, DEFAULT_DEBUGGER_HOST, DEFAULT_DEBUGGER_PORT } from '../debugger-client';
import WebSocket from 'ws';

jest.mock('ws');

describe('JerryDebugger constructor', () => {
  it('uses supplied option values', () => {
    const delegate = {} as any;
    const jd = new JerryDebuggerClient({
      delegate,
      host: '10.10.10.10',
      port: 4096,
    });
    expect((jd as any).delegate).toEqual(delegate);
    expect(jd.host).toEqual('10.10.10.10');
    expect(jd.port).toEqual(4096);
  });

  it('supplies option defaults when missing', () => {
    const delegate = {} as any;
    const jd = new JerryDebuggerClient({ delegate });
    expect(jd.host).toEqual(DEFAULT_DEBUGGER_HOST);
    expect(jd.port).toEqual(DEFAULT_DEBUGGER_PORT);
  });
});

describe('JerryDebugger.connect', () => {
  it('creates a websocket', () => {
    const delegate = {} as any;
    const jd = new JerryDebuggerClient({ delegate });
    jd.connect();
    expect(WebSocket).toHaveBeenCalledTimes(1);
  });
});
