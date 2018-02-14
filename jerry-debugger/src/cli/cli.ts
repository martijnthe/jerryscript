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

import { ChromeDevToolsProxyServer } from '../lib/cdt-proxy';
import parseArgs from 'minimist';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 9229;

function getHostAndPort(input: string) {
  const hostAndPort = input.split(':');
  const onlyPort = (hostAndPort.length === 1);
  return {
    host: onlyPort ? DEFAULT_HOST : hostAndPort[0],
    port: Number(onlyPort ? hostAndPort[0] : hostAndPort[1]),
  };
}

export function getOptionsFromArgs(argv: Array<string>) {
  const args = parseArgs(argv, {
    default: {
      'inspect-brk': `${DEFAULT_HOST}:${DEFAULT_PORT}`,
    },
    string: [
      'inspect-brk',
    ],
  });

  const target = args['inspect-brk'];
  return {
    ...getHostAndPort(target),
  };
}

export function main(proc: NodeJS.Process) {
  const options = getOptionsFromArgs(proc.argv.slice(2));
  const msg = `Debugger listening on ws://127.0.0.1:${options.port}/3cf67898-d993-41e4-8160-d970c9872cb3\n`;
  proc.stdout.write(msg);
  new ChromeDevToolsProxyServer({
    port: options.port,
    host: options.host,
  });
}
