// Type definitions for adding validator to restify

/// <reference path="../express-validator/express-validator.d.ts" />
/// <reference path="../restify/restify.d.ts" />

declare module "restify" {
    import http = require('http');
    import validator = require('express-validator');

    interface Request extends http.ServerRequest {
        checkBody(field: string, message: string): validator.Validator;
        checkParams(field: string, message: string): validator.Validator;
        checkQuery(field: string, message: string): validator.Validator;
        checkHeader(field: string, message: string): validator.Validator;
        sanitize(field: string): validator.Sanitizer;
        onValidationError(func:(msg: string) => void): void;
        validationErrors(mapped?: boolean): any;
    }
}

declare module "express-validator" {
    import restify = require('restify');
    function ExpressValidator(middlewareOptions?: any): restify.RequestHandler;
}
