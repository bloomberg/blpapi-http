Contributing to blpapi-http
===========================

So you're interested in giving us a hand?  That's awesome!  We've put together
some guidelines that should help you get started.

There are many ways to get involved - this document covers:

* [development workflow](#development-workflow)
* [issues](#reporting-an-issue)
  * [bug reports](#bug-reports)
  * [feature requests](#feature-requests)
  * [change requests](#change-requests)
* [submitting pull requests](#submitting-pull-requests)
* [milestones](#milestones)
* [testing](#testing)


## Development workflow

This project has adopted the
[gitflow](http://nvie.com/posts/a-successful-git-branching-model/) branching
model derived by Vincent Driessen.  Please see respective guidelines under
[submitting pull requests](#submitting-pull-requests) that discusses the
appropriate branches to to branch from.


## Reporting an issue

If you are going to raise an issue because you think you've found a problem, or
you would like to submit a request for an awesome new feature, or for anything
else... please read on.

GitHub issues is the preferred mechanism for [bug reports](#bug-reports),
[feature requests](#feature-requests), [change requests](#change-requests), and
[submitting pull requests](#submitting-pull-requests).  However, please respect
the following general restrictions:

* Before submitting an issue, please **search** if one already exists.  Help us
  keep duplicate issues to a minimum by checking if someone has already
  reported your problem or idea.

* Please keep discussions **on topic** and **respect** the opinions of others.


### Bug reports

A bug is a _demonstrable problem_ that is caused by code in this repository.
We appreciate good bug reports!

Guidelines for bug reports:

1. **Search for the issue** &mdash; check if the issue has already been
   reported.

2. **Check if the issue has been fixed** &mdash; try to reproduce it using the
   latest `develop` branch or look for [closed issues](http://github.com/bloomberg/blpapi-http/issues?q=is%3Aissue+is%3Aclosed).

3. **Reduce the problem** &mdash; minimizing the dependencies while still being
   able to reproduce the problem is awesome.

It is important to include the details of your environment and [what you have
tried](http://whathaveyoutried.com).  Great bug reports shouldn't leave others
needing to ask for further information; however, sometimes that does happen -
not everyone is perfect.


### Feature requests

Features requests are always welcome!  Thanks for wanting to help out.  Before
you submit:

1. **Search around** if your feature is already being worked on or is already
   listed in our [milestones](#milestones).

2. Think about whether your idea fits with the scope of the project and its
   direction.

3. Make a strong case to convince the core contributors of the merits of the
   feature.  Please provide as much detail as possible explaining the context
   and use case.


### Change requests

Change requests cover the internal architectural and functional change to how
blpapi-http works.  This includes new dependencies (or removal of them),
refactorings, or an improvements to the system.

1. **Search around** and make sure a similar request doesn't already exist.

2. Please take the time to think about the best way to make a case for the
   change.  Are you sure it is not a [bug report](#bug-reports) or a [feature
   request](#feature-requests)?  What is the context and what precise problem
   is it solving; or is it many?  Why this change that you are suggesting
   making (or replacing) what is already there better?  Does it fit within the
   direction of the project?


## Submitting pull requests

We love pull requests!  If you are raising a PR for something which doesn't
have an open issue, please think carefully about [raising an
issue](#reporting-an-issue) that your PR can close - especially if it is a bug.
To expedite the process and ensure the acceptance of your PR, please read all
the of guidelines on:

* [code standards](doc/style-guide.md)
* [commit messages](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html) -
  the summary line-length is relaxed to something reasonable

Also when developing, and especially when fixing a bug, make sure that you base
your PR off of an appropriate branching point in accordance with [development
workflow](#development-workflow).  For addressing a bug for release, base your
branch off of the appropriate release branch.  If it is a severe bug and an
official release has already happened, create a hot-fix branch off of `master`.
Anything else typically can be based off of the `develop` branch.  If you are
not sure where to start, ask in the issue your PR is planning to close or reach
out to the core contributors for guidance.


## Milestones

This project utilizies GitHub's
[milestones](http://github.com/bloomberg/blpapi-http/milestones).


## Testing

Yes - we need this.  Once there is some code and a simple foundation, this will
be built and more content will be written here.
