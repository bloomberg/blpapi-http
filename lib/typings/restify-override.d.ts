// Type definition overrides for restify

declare module "restify" {
    // borisyankov/DefinitelyTyped#3546
    export class UnsupportedMediaTypeError { constructor(message: any); }
}

