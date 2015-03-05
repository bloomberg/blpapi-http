/// <reference path='../../typings/tsd.d.ts' />

import _ = require('lodash');
import restify = require('restify');
import Interface = require('../interface');

// Uses express-validator to check the request for any problems. Callers pass a function that
// performs whatever validation checks are necessary, and the returned RequestHandler will do the
// boilerplate. The returned function is named and not just an anonymous function for logging
// purposes.
// Note that this function is for internal use; callers should use one of the wrappers below.
// TODO: Extend this to allow chaining of wrappers.
function validateRequest(check: (req: Interface.IOurRequest) => void): restify.RequestHandler
{
    function validateRequest(req: Interface.IOurRequest,
                             res: Interface.IOurResponse,
                             next: restify.Next): void {
        check(req);
        var errors = req.validationErrors(true);
        if (errors) {
            req.log.debug(errors, 'Invalid request');
            return next(new restify.BadRequestError('Invalid request: ' + JSON.stringify(
                errors)));
        }
        return next();
    }

    return validateRequest;
}

// Require that the query params contain specific names.
export function requireQueryParams(params: string[]): restify.RequestHandler
{
    return validateRequest((req: Interface.IOurRequest): void => {
        _.forEach(params, (param: string): void => {
            req.checkQuery(param, 'Missing ' + param).notEmpty();
        });
    });
}

// Require that the query params contain specific names with int values.
export function requireIntQueryParams(params: string[]): restify.RequestHandler
{
    return validateRequest((req: Interface.IOurRequest): void => {
        _.forEach(params, (param: string): void => {
            req.checkQuery(param, 'Invalid ' + param).isInt();
        });
    });
}

// Require a specific query param to have a value from a set of choices.
export function requireChoiceQueryParam(param: string, values: string[]): restify.RequestHandler
{
    return validateRequest((req: Interface.IOurRequest): void => {
        req.checkQuery(param, 'Invalid ' + param).isIn(values);
    });
}

export function requireActionQueryParam(values: string[]): restify.RequestHandler
{
    return requireChoiceQueryParam('action', values);
}
