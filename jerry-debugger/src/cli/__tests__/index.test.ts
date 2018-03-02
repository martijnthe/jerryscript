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

describe('getOptionsFromArgs', () => {

  it('works without --inspect-brk', () => {
    const opt = getOptionsFromArgs([]);
    expect(opt.proxyAddress.host).toEqual(undefined);
    expect(opt.proxyAddress.port).toEqual(undefined);
  });

  it('parses --inspect-brk with port only', () => {
    const opt = getOptionsFromArgs(['--inspect-brk=1234']);
    expect(opt.proxyAddress.host).toEqual(undefined);
    expect(opt.proxyAddress.port).toEqual(1234);
  });

  it('parses --inspect-brk with no port', () => {
    const opt = getOptionsFromArgs(['--inspect-brk=10.10.10.10:']);
    expect(opt.proxyAddress.host).toEqual('10.10.10.10');
    expect(opt.proxyAddress.port).toEqual(undefined);
  });

  it('parses --inspect-brk with no host', () => {
    const opt = getOptionsFromArgs(['--inspect-brk=:1234']);
    expect(opt.proxyAddress.host).toEqual(undefined);
    expect(opt.proxyAddress.port).toEqual(1234);
  });

  it('parses --inspect-brk with host and port', () => {
    const opt = getOptionsFromArgs(['--inspect-brk=10.10.10.10:1234']);
    expect(opt.proxyAddress.host).toEqual('10.10.10.10');
    expect(opt.proxyAddress.port).toEqual(1234);
  });

  it('works without --jerry-remote', () => {
    const opt = getOptionsFromArgs([]);
    expect(opt.remoteAddress.host).toEqual(undefined);
    expect(opt.remoteAddress.port).toEqual(undefined);
  });

  it('parses --jerry-remote with port only', () => {
    const opt = getOptionsFromArgs(['--jerry-remote=1234']);
    expect(opt.remoteAddress.host).toEqual(undefined);
    expect(opt.remoteAddress.port).toEqual(1234);
  });

  it('parses --jerry-remote with host and port', () => {
    const opt = getOptionsFromArgs(['--jerry-remote=10.10.10.10:1234']);
    expect(opt.remoteAddress.host).toEqual('10.10.10.10');
    expect(opt.remoteAddress.port).toEqual(1234);
  });

  it('verbose defaults to false', () => {
    const opt = getOptionsFromArgs([]);
    expect(opt.verbose).toEqual(false);
  });

  it('parses verbose flag', () => {
    const opt = getOptionsFromArgs(['--verbose']);
    expect(opt.verbose).toEqual(true);
  });

  it('parses v alias for verbose', () => {
    const opt = getOptionsFromArgs(['-v']);
    expect(opt.verbose).toEqual(true);
  });

  it('jsfile defaults to untitled.js', () => {
    const opt = getOptionsFromArgs([]);
    expect(opt.jsfile).toEqual('untitled.js');
  });

  it('returns client source as jsfile', () => {
    const opt = getOptionsFromArgs(['foo/bar.js']);
    expect(opt.jsfile).toEqual('foo/bar.js');
  });

});
