#!/bin/bash

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"
echo $ROOT_DIR
docker build -f $ROOT_DIR/tests/klee/Dockerfile -t jerryscript-klee:latest $ROOT_DIR
