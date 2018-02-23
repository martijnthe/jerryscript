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

import { ChromeDevToolsProxyServer, DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT } from '../lib/cdt-proxy';
import { JerryDebugger } from '../lib/debugger-client';
import parseArgs from 'minimist';

function getHostAndPort(input: string) {
  const hostAndPort = input.split(':');
  const onlyPort = (hostAndPort.length === 1);
  return {
    host: onlyPort ? DEFAULT_SERVER_HOST : hostAndPort[0],
    port: Number(onlyPort ? hostAndPort[0] : hostAndPort[1]),
  };
}

export function getOptionsFromArgs(argv: Array<string>) {
  const args = parseArgs(argv, {
    default: {
      'client-source': '',
      'inspect-brk': `${DEFAULT_SERVER_HOST}:${DEFAULT_SERVER_PORT}`,
      'verbose': false,
    },
    alias: {
      'verbose': 'v',
    },
    boolean: [
      'verbose',
    ],
    string: [
      'client-source',
      'inspect-brk',
    ],
  });

  const target = args['inspect-brk'];
  return {
    ...getHostAndPort(target),
    verbose: args['verbose'],
    address: args._[0] || '',
    jsfile: args['client-source'] || 'untitled.js',
  };
}

export function main(proc: NodeJS.Process) {
  const options = getOptionsFromArgs(proc.argv.slice(2));
  const jdebug = new JerryDebugger(options.address);
  const debuggerUrl = `ws://${jdebug.host}:${jdebug.port}`;
  jdebug.getConnectPromise().then(() => {
    proc.stdout.write(`Connected to debugger at ${debuggerUrl}\n`);
    proc.stdout.write(`Proxy listening at ws://${options.host}:${options.port}\n`);
    new ChromeDevToolsProxyServer({
      host: options.host,
      port: options.port,
      jsfile: options.jsfile,
    });
  }).catch(() => {
    proc.stdout.write(`Debugger not found at ${debuggerUrl}\n`);
  });
}
