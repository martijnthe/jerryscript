/* Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef JERRYX_ARGS_IMPL_H
#define JERRYX_ARGS_IMPL_H

/* transform functions for each type. */
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_number_strict);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_number_strict_optional);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_number_optional);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_number);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_boolean_strict);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_boolean_strict_optional);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_boolean_optional);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_boolean);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_string_strict);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_string_strict_optional);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_string_optional);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_string);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_function);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_function_optional);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_native_pointer);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_native_pointer_optional);
JERRYX_ARG_TRANSFORM_FUNC (jerryx_arg_transform_ignore);

/**
 * Create a jerryx_arg_t instance for number argument.
 *
 * @return a jerryx_arg_t instance.
 */
static inline jerryx_arg_t
jerryx_arg_number (double *dest, /**< points to the native number */
                   jerryx_arg_coerce_t coerce_flag, /**< whether the type coercion is allowed */
                   jerryx_arg_optional_t opt_flag) /**< whether it is optional argument */
{
  jerryx_arg_transform_func_t func;

  if (coerce_flag == JERRYX_ARG_NO_COERCE)
  {
    if (opt_flag == JERRYX_ARG_OPTIONAL)
    {
      func = jerryx_arg_transform_number_strict_optional;
    }
    else
    {
      func = jerryx_arg_transform_number_strict;
    }
  }
  else
  {
    if (opt_flag == JERRYX_ARG_OPTIONAL)
    {
      func = jerryx_arg_transform_number_optional;
    }
    else
    {
      func = jerryx_arg_transform_number;
    }
  }

  return (jerryx_arg_t)
  {
    .func = func,
    .dest = (void *) dest
  };
} /* jerryx_arg_number */

/**
 * Create a jerryx_arg_t instance for boolean argument.
 *
 * @return a jerryx_arg_t instance.
 */
static inline jerryx_arg_t
jerryx_arg_boolean (bool *dest, /**< points to the native bool */
                    jerryx_arg_coerce_t coerce_flag, /**< whether the type coercion is allowed */
                    jerryx_arg_optional_t opt_flag) /**< whether it is optional argument */
{
  jerryx_arg_transform_func_t func;

  if (coerce_flag == JERRYX_ARG_NO_COERCE)
  {
    if (opt_flag == JERRYX_ARG_OPTIONAL)
    {
      func = jerryx_arg_transform_boolean_strict_optional;
    }
    else
    {
      func = jerryx_arg_transform_boolean_strict;
    }
  }
  else
  {
    if (opt_flag == JERRYX_ARG_OPTIONAL)
    {
      func = jerryx_arg_transform_boolean_optional;
    }
    else
    {
      func = jerryx_arg_transform_boolean;
    }
  }

  return (jerryx_arg_t)
  {
    .func = func,
    .dest = (void *) dest
  };
} /* jerryx_arg_boolean */

/**
 * Create a jerryx_arg_t instance for string argument.
 *
 * @return a jerryx_arg_t instance.
 */
static inline jerryx_arg_t
jerryx_arg_string (char *dest, /**< points to the native char array */
                   uint32_t size, /**< the size of native char array */
                   jerryx_arg_coerce_t coerce_flag, /**< whether the type coercion is allowed */
                   jerryx_arg_optional_t opt_flag) /**< whether it is optional argument */
{
  jerryx_arg_transform_func_t func;

  if (coerce_flag == JERRYX_ARG_NO_COERCE)
  {
    if (opt_flag == JERRYX_ARG_OPTIONAL)
    {
      func = jerryx_arg_transform_string_strict_optional;
    }
    else
    {
      func = jerryx_arg_transform_string_strict;
    }
  }
  else
  {
    if (opt_flag == JERRYX_ARG_OPTIONAL)
    {
      func = jerryx_arg_transform_string_optional;
    }
    else
    {
      func = jerryx_arg_transform_string;
    }
  }

  return (jerryx_arg_t)
  {
    .func = func,
    .dest = (void *) dest,
    .extra_info = (uintptr_t) size
  };
} /* jerryx_arg_string */

/**
 * Create a jerryx_arg_t instance for function argument.
 *
 * @return a jerryx_arg_t instance.
 */
static inline jerryx_arg_t
jerryx_arg_function (jerry_value_t *dest, /**< points to the js function value */
                     jerryx_arg_optional_t opt_flag) /**< whether it is optional argument */
{
  jerryx_arg_transform_func_t func;

  if (opt_flag == JERRYX_ARG_OPTIONAL)
  {
    func = jerryx_arg_transform_function_optional;
  }
  else
  {
    func = jerryx_arg_transform_function;
  }

  return (jerryx_arg_t)
  {
    .func = func,
    .dest = (void *) dest
  };
} /* jerryx_arg_function */

/**
 * Create a jerryx_arg_t instance for native pointer argument.
 *
 * @return a jerryx_arg_t instance.
 */
static inline jerryx_arg_t
jerryx_arg_native_pointer (void **dest, /**< points to the native pointer */
                           const jerry_object_native_info_t *info_p, /**< expected the type info */
                           jerryx_arg_optional_t opt_flag) /**< whether it is optional argument */
{
  jerryx_arg_transform_func_t func;

  if (opt_flag == JERRYX_ARG_OPTIONAL)
  {
    func = jerryx_arg_transform_native_pointer_optional;
  }
  else
  {
    func = jerryx_arg_transform_native_pointer;
  }

  return (jerryx_arg_t)
  {
    .func = func,
    .dest = (void *) dest,
    .extra_info = (uintptr_t) info_p
  };
} /* jerryx_arg_native_pointer */

/**
 * Create a jerryx_arg_t instance for ignored argument.
 *
 * @return a jerryx_arg_t instance.
 */
static inline jerryx_arg_t
jerryx_arg_ignore (void)
{
  return (jerryx_arg_t)
  {
    .func = jerryx_arg_transform_ignore
  };
} /* jerryx_arg_ignore */

/**
 * Create a jerryx_arg_t instance with custom transform.
 *
 * @return a jerryx_arg_t instance.
 */
static inline jerryx_arg_t
jerryx_arg_custom (void *dest, /**< points to the native argument */
                   uintptr_t extra_info, /**< the extra infomation of the jerryx_arg_t */
                   jerryx_arg_transform_func_t func) /**< the custom transform function */
{
  return (jerryx_arg_t)
  {
    .func = func,
    .dest = dest,
    .extra_info = extra_info
  };
} /* jerryx_arg_custom */

#endif /* !JERRYX_ARGS_IMPL_H */
