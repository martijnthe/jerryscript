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

#include "args-internal.h"
#include "jerryscript-ext/args.h"
#include "jerryscript.h"

/**
 * Pop the current JS argument from the iterator.
 * It will change the index and js_arg_p value in the iterator.
 *
 * @return the current JS argument.
 */
jerry_value_t
jerryx_arg_js_iterator_pop (jerryx_arg_js_iterator_t *js_arg_iter_p) /**< the JS arg iterator */
{
  return (js_arg_iter_p->js_arg_idx++ < js_arg_iter_p->js_arg_cnt ? *js_arg_iter_p->js_arg_p++
                                                                  : jerry_create_undefined ());
} /* jerryx_arg_js_iterator_pop */

/**
 * Get the current JS argument from the iterator.
 *
 * Note:
 *     Unlike jerryx_arg_js_iterator_pop, it will not change index and
 *     js_arg_p value in the iterator.
 *
 * @return the current JS argument.
 */
jerry_value_t
jerryx_arg_js_iterator_peek (jerryx_arg_js_iterator_t *js_arg_iter_p) /**< the JS arg iterator */
{
  return (js_arg_iter_p->js_arg_idx < js_arg_iter_p->js_arg_cnt ? *js_arg_iter_p->js_arg_p
                                                                : jerry_create_undefined ());
} /* jerryx_arg_js_iterator_peek */

/**
 * Get the index of the current JS argument
 *
 * @return the index
 */
jerry_length_t
jerryx_arg_js_iterator_get_index (jerryx_arg_js_iterator_t *js_arg_iter_p) /**< the JS arg iterator */
{
  return js_arg_iter_p->js_arg_idx;
} /* jerryx_arg_js_iterator_get_index */
