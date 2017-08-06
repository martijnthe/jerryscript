#include <jerryscript.h>
#include <klee/klee.h>
#include <string.h>

#define SCRIPT_SIZE (32)

int
main ()
{
  jerry_char_t script[SCRIPT_SIZE];

  klee_make_symbolic (script, SCRIPT_SIZE, "script");

  script[SCRIPT_SIZE - 1] = '\0';
  const jerry_size_t script_size = (jerry_size_t) strlen ((const char *) script);

  jerry_init (JERRY_INIT_EMPTY);

  if (!jerry_is_valid_utf8_string (script, script_size)) {
    return 0;
  }

  jerry_value_t ret_value = jerry_parse (script, script_size, false);
  jerry_release_value(ret_value);

  jerry_cleanup ();

  return 0;
}
