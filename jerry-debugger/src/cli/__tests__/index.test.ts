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

import { getOptionsFromArgs } from '../cli';
import { DEFAULT_SERVER_HOST } from '../../lib/cdt-proxy';

describe('getOptionsFromArgs', () => {

  it('parses --inspect-brk with port only', () => {
    const opt = getOptionsFromArgs(['--inspect-brk=1234']);
    expect(opt.host).toEqual(DEFAULT_SERVER_HOST);
    expect(opt.port).toEqual(1234);
  });

  it('parses --inspect-brk with host and port', () => {
    const opt = getOptionsFromArgs(['--inspect-brk=10.10.10.10:1234']);
    expect(opt.host).toEqual('10.10.10.10');
    expect(opt.port).toEqual(1234);
  });

});
