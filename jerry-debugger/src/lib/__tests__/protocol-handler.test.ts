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

import { JerryDebugProtocolHandler } from '../protocol-handler';
import * as SP from '../jrs-protocol-constants';

describe('onConfiguration', () => {
  const delegate = {
    onError: jest.fn(),
  };
  const handler = new JerryDebugProtocolHandler(delegate);

  beforeEach(() => {
    delegate.onError.mockClear();
  });

  it('aborts when message too short', () => {
    const array = Uint8Array.from([1, 2, 3, 4]);
    handler.onConfiguration(array);
    expect(delegate.onError).toHaveBeenCalledTimes(1);
  });

  it('aborts when message too long', () => {
    const array = Uint8Array.from([1, 2, 3, 4, 5, 6]);
    handler.onConfiguration(array);
    expect(delegate.onError).toHaveBeenCalledTimes(1);
  });

  it('aborts when compressed pointer wrong size', () => {
    const array = Uint8Array.from([0, 200, 6, 1, 1]);
    handler.onConfiguration(array);
    expect(delegate.onError).toHaveBeenCalledTimes(1);
  });

  it('aborts when version unexpected', () => {
    const array = Uint8Array.from([0, 200, 4, 1, 2]);
    handler.onConfiguration(array);
    expect(delegate.onError).toHaveBeenCalledTimes(1);
  });

  it('succeeds when everything is normal', () => {
    const array = Uint8Array.from([0, 200, 4, 1, 1]);
    handler.onConfiguration(array);
    expect(delegate.onError).toHaveBeenCalledTimes(0);
  });
});

describe('onSourceCode', () => {
  const delegate = {
    onScriptParsed: jest.fn(),
  };
  let handler: JerryDebugProtocolHandler;

  beforeEach(() => {
    delegate.onScriptParsed.mockClear();
    handler = new JerryDebugProtocolHandler(delegate);
  });

  it('does not call scriptParsed after only SOURCE message', () => {
    const array = Uint8Array.from([SP.JERRY_DEBUGGER_SOURCE_CODE,
      'a'.charCodeAt(0), 'b'.charCodeAt(0), 'c'.charCodeAt(0)]);
    handler.onSourceCode(array);
    expect(delegate.onScriptParsed).toHaveBeenCalledTimes(0);
  });

  it('immediately calls scriptParsed from END message', () => {
    const array = Uint8Array.from([SP.JERRY_DEBUGGER_SOURCE_CODE_END,
      'a'.charCodeAt(0), 'b'.charCodeAt(0), 'c'.charCodeAt(0)]);
    handler.onSourceCode(array);
    expect(delegate.onScriptParsed).toHaveBeenCalledTimes(1);
    const data = delegate.onScriptParsed.mock.calls[0][0];
    expect(data.lineCount).toEqual(1);
  });
});

describe('onMessage', () => {
  const delegate = {
    onError: jest.fn(),
  };
  const handler = new JerryDebugProtocolHandler(delegate);

  beforeEach(() => {
    delegate.onError.mockClear();
  });

  it('aborts when message too short', () => {
    handler.onMessage(new ArrayBuffer(0));
    expect(delegate.onError).toHaveBeenCalledTimes(1);
  });

  it('aborts when first message is not configuration', () => {
    const array = Uint8Array.from([SP.JERRY_DEBUGGER_SOURCE_CODE_END, 1, 2, 3]);
    handler.onMessage(array.buffer);
    expect(delegate.onError).toHaveBeenCalledTimes(1);
  });

  it('aborts when unhandled message sent', () => {
    const array = Uint8Array.from([SP.JERRY_DEBUGGER_CONFIGURATION, 200, 4, 1, 1]);
    handler.onMessage(array.buffer);
    expect(delegate.onError).toHaveBeenCalledTimes(0);
    array[0] = 255;
    handler.onMessage(array.buffer);
    expect(delegate.onError).toHaveBeenCalledTimes(1);
  });
});
