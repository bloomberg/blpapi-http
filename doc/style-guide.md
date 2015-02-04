# BLPAPI HTTP Style Guide

This is the TypeScript style guide that captures everything not checked by
[tslint](https://github.com/palantir/tslint).

## Table of Contents

  1. [Introduction](#introduction)
  1. [Files](#files)
  1. [Indentation](#indentation)
  1. [Line Length](#line-length)


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
