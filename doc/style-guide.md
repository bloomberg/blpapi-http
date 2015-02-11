# BLPAPI HTTP Style Guide

This is the TypeScript style guide that captures everything not checked by
[tslint](https://github.com/palantir/tslint).

## Table of Contents

  1. [Introduction](#introduction)
  1. [Files](#files)
  1. [Indentation](#indentation)
  1. [Line Length](#line-length)
  1. [Expressions](#expressions)
  1. [Object and Array Literals](#object-and-array-literals)


## Introduction

When developing software in collaboration with many different individuals, the value of the
software is directly affected by the quality of the codebase.  Consistent coding conventions are
important when the code is developed over many years and handled/seen by others.  Consistent
conventions lend themselves to easier readability and understanding of the codebase for newcomers,
avoiding frustration and time spent not being productive.  Not only will consistent conventions
help new developers, but should also help quickly identify potential flaws; thus, improving overall
quaility.

## Files
  - All TypeScript files must end with the `.ts` extensions.
  - File names should all be lowercase and only include letters, numbers, and
    dashes.
  - It is recommended to separate words with dashes (i.e., `-`) for readability.

**[top](#table-of-contents)**

## Indentation
  - The unit of indentation is four spaces.
  - **Never use tabs**, this causes problems with differing interpretations by different
    IDE/editors.  Most editors have configuration options to change tabs to spaces.

**[top](#table-of-contents)**

## Line Length
  - Lines should not be longer than 100 characters.
  - When a statement runs over 100 characters on a line, wrap after a comma or an operator.
  - Long strings at the end of statements that go over 100 characters are acceptable on the basis
    of readability.  Please use your own judgement of what is acceptable for being over the 100
    character limit.

**[top](#table-of-contents)**

## Expressions

  - Expressions in return statements should be surrounded by parenthesis for clarity.
    - If the expression contains one operand, parenthesis are not necessary.
    - Use surrounding parenthesis around the conditional expression of a *ternary
      operator*; not for the entire ternary expression.
  ```typescript
  // bad
  function foo(a: number) {
      return a > 1;
  }

  // bad
  function foo(a: number) {
      return a > 1 ? true : false;
  }

  // OK
  function foo(a: number) {
      return ((a > 1) ? -1 : 0);
  }

  // OK
  function isZero(a: number) {
      return (!a);
  }

  // good
  function foo(a: number) {
      return (a > 1);
  }

  // good
  function foo(a: number) {
      return (a > 1) ? -1 : 0;
  }

  // good
  function isZero(a: number) {
      return !a;
  }
  ```

**[top](#table-of-contents)**

## Object and Array Literals

  - Object literals
    - Use curly braces `{}` instead of `new Object()`.
    - The opening curly brace (i.e., `{`) must be on the same line as the declaration, expression,
      or statement.
    - The closing curly brace (i.e., `}`) must be on its own line aligned at the same indentation
      level as line with the opening curly brace.
    - Each `property: value` pair must be on its own line followed by a comma `,` indented by the
      [indentation](#indentation) style specified within this document.
    - The final property/value pair *should not* be followed by a comma `,`.
    - If an object contains one property/value pair, it is acceptable to have the property/value
      pair on one line with a space after the opening `{` and before the closing `}`.
    ```typescript
    // bad
    var obj = {foo: 1};

    // bad
    var obj = { foo: 1, bar: 2 };

    // bad
    var obj = { foo: 1,
                bar: 2};

    // bad
    var obj = {
        foo: 1,
        bar: 2,
    };

    // OK
    var obj = { foo: 1 };

    // good
    var obj = {};

    // good
    var obj = {
        foo: 1
    };

    // good
    var obj = {
        foo: 1,
        bar: 2
    };
    ```

  - Array literals
    - Use brackets `[]` instead of `new Array()`.
    - It is preferable to have an array literal on one line if and only if it fits within
      [line length](#line-length) style specified within this document with a space after the
      opening `[` and before the closing `]`.  If the array elements are of varying length, please
      use your own judgement as to whether to list each element on separate lines as defined in the
      following bullet points.
    - The opening bracket (i.e., `[`) must be on the same line as the declaration, expression, or
      statement.
    - The closing bracket (i.e., `]`) must be on its own line aligned at the same indentation level
      as line with the opening bracket.
    - Each array element must be on its own line followed by a comma `,` indented by the
      [indentation](#indentation) style specified within this document.
    - The final array element *should not* be followed by a comma `,`.
    ```typescript
    // bad
    var arr = [1,
               2];

    // bad
    var arr = [1, 2, 3, 4, 5];

    // bad
    var arr = [
        1,
        2,
    ]

    // bad
    var arr = [ "this", "is", "has", "variable", "length", "elements" ];

    // good
    var arr = [];

    // best and preferred
    var arr = [ 1, 2, 3, 4, 5 ];

    // good
    var arr = [
        "this",
        "is",
        "has",
        "variable",
        "length",
        "elements"
    ];

    // good
    var arr = [
        1
    ];

    // good
    var arr = [
        1,
        2,
        3,
        4
    ];
    ```

**[top](#table-of-contents)**

<!--
vim: tw=99
-->
