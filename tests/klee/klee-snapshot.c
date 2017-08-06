#include <jerryscript.h>
#include <klee/klee.h>
#include <string.h>

#define SNAPSHOT_SIZE_WORDS_BEGIN (0)
#define SNAPSHOT_SIZE_WORDS_END   (32)

int
main ()
{
  const size_t snapshot_size_words = (size_t) klee_range (
      SNAPSHOT_SIZE_WORDS_BEGIN, SNAPSHOT_SIZE_WORDS_END, "snapshot size");
  klee_assume(snapshot_size_words >= SNAPSHOT_SIZE_WORDS_BEGIN);
  klee_assume(snapshot_size_words < SNAPSHOT_SIZE_WORDS_END); // my upper bound
  uint32_t snapshot[snapshot_size_words];
  klee_make_symbolic (snapshot, sizeof(snapshot), "snapshot");

  jerry_init (JERRY_INIT_EMPTY);

  const jerry_value_t ret_value = jerry_exec_snapshot (snapshot, snapshot_size_words * sizeof(uint32_t), false);
  jerry_release_value (ret_value);

  jerry_cleanup ();

  return 0;
}
