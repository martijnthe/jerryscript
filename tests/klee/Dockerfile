FROM klee/klee:1.4.0

ENV home /home/klee
USER root

COPY jerry-core/     ${home}/jerryscript/jerry-core
COPY jerry-ext/      ${home}/jerryscript/jerry-ext
COPY jerry-libc/     ${home}/jerryscript/jerry-libc
COPY jerry-libm/     ${home}/jerryscript/jerry-libm
COPY jerry-main/     ${home}/jerryscript/jerry-main
COPY jerry-port/     ${home}/jerryscript/jerry-port
COPY jerry-port/     ${home}/jerryscript/jerry-port
COPY tests/          ${home}/jerryscript/tests
COPY tools/          ${home}/jerryscript/tools
COPY CMakeLists.txt  ${home}/jerryscript/CMakeLists.txt

RUN chown -R klee:klee ${home}/jerryscript

USER klee
RUN ${home}/jerryscript/tools/build.py --jerry-libc OFF --jerry-libm OFF --jerry-ext OFF --jerry-cmdline OFF \
--unittests --compile-flag="-emit-llvm -I${home}/klee_src/include"


# cd ${home}/jerryscript/build && klee -libc=uclibc -link-llvm-lib=./lib/libunit-klee-parse.a -link-llvm-lib=./lib/libjerry-core.a -link-llvm-lib=./lib/libjerry-port-default.a ./tests/klee/CMakeFiles/unit-klee-parse.dir/klee-parse.c.o
# cd ${home}/jerryscript/build && klee -libc=uclibc -link-llvm-lib=./lib/libunit-klee-parse.a -link-llvm-lib=./lib/libjerry-core.a -link-llvm-lib=./lib/libjerry-port-default.a ./tests/klee/CMakeFiles/unit-klee-snapshot.dir/klee-snapshot.c.o
