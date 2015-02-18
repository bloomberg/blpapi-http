HTTP API
========

The [Bloomberg Open API] provides access to market data. The
[Bloomberg HTTP API] makes the [Open API] available via HTTP: clients POST
commands to a HTTP server, which will respond with the corresponding data.

The [HTTP API] is currently in development and does not yet provide access
to all services that the [Open API] provides. At this time it supports the
Reference Data Service (i.e. //blp/refdata) and the API Field Service
(//blp/apiflds).

This document provides an overview of the [HTTP API]: the URLs to use and the
formatting for the HTTP requests and responses. We assume, for the purposes of
this doc, that the server at http://blpapihost.example.com/ is running an
instance of this API.

This document also includes basic information about some of the underlying
[Open API] operations. For more details on the [Open API], refer to the
[BLPAPI Developer's Guide]. Where appropriate, this document will refer to
specific sections of the [Developer's Guide].

[Bloomberg Open API]: http://bloomberglabs.com/api
[Open API]: http://bloomberglabs.com/api
[Bloomberg HTTP API]: http://github.com/bloomberg/blpapi-http
[HTTP API]: http://github.com/bloomberg/blpapi-http
[BLPAPI Developer's Guide]: http://www.bloomberglabs.com/files/2014/07/blpapi-developers-guide-2.54.pdf
[Developer's Guide]: http://www.bloomberglabs.com/files/2014/07/blpapi-developers-guide-2.54.pdf


Requesting data
---------------

Clients access services that use the Request/Response paradigm via `/request`:

```
http://blpapihost.example.com/request?ns=<namespace>&service=<service>&type=<requestType>
```

`/request` requires three query parameters:

* `ns` -- The namespace for the service on which we're making the request.
Currently all services are in the `blp` namespace.
* `service` -- The service on which we're making the request. Currently
`refdata` and `apiflds` are supported; more will be added in future
versions.
* `type` -- The request type for this operation. For `//blp/refdata`,
the operations are listed in section A.2.1 (and detailed in section 7.2) of the
[Developer's Guide].

The body of the POST should consist of a JSON object containing the parameters
for the request. Each operation defines what parameters it uses; sections 7.2
and A.2 of the [Developer's Guide] provide full details.

As an example, the following will request the open and last price for IBM and
Apple stock for each day during the period Jan 1 - 5, 2012.

```
curl -X POST 'http://blpapihost.example.com/request?ns=blp&service=refdata&type=HistoricalDataRequest' --data @- <<EOF
{ "securities": ["IBM US Equity", "AAPL US Equity"],
  "fields": ["PX_LAST", "OPEN"],
  "startDate": "20120101",
  "endDate": "20120105",
  "periodicitySelection": "DAILY" }
EOF
```


HTTP request headers
--------------------

The client may specify the following HTTP request headers to tell the server
what sorts of responses it can use:

* `accept`: Content types. The server currently supports `application/json`.
Future versions may support other types.
* `accept-encoding`: Compression formats. The server supports gzip encoding
(i.e. `accept-encoding: gzip`).
* `accept-version`: HTTP API version. This document describes version 1.0.0. We
encourage clients to explicitly specify this header; however, if it is not
specified, the server defaults to 1.0.0.

Other request headers:

* `content-type`: The server currently only supports `application/json`, so it
ignores this header for now. Future versions may support additional formats,
so we encourage clients to explicitly specify this header.


Response format
---------------

The HTTP response message body consists of a JSON object with the following
properties:

* `status`: If we successfully communicated with the Open API, this will be 0.
Otherwise, it will contain details about the error.
* `message`: If we successfully communicated with the Open API, this will be
"OK". Otherwise, it will contain a description of the error.
* `data`: The response from the Open API (only present if `"message": "OK"`).
The exact structure of this value depends on the operation, and is detailed in
section A.2.14 of the [Developer's Guide].

Note that `"message": "OK"` doesn't necessarily mean that the request
successfully got useful data. If the HTTP server successfully makes the Open
API call but there was an error in executing the operation (e.g. because a
required parameter for that operation was not specified), then `"status": 0`
and `"message": "OK"` but the data returned from the API will contain an error
(e.g. in a `responseError` property of the data, or a `securityError` property
of one or more of the `securityData`).

Below is the response from the example request in the previous section. Notice
that the response JSON at the top level has just the three properties and that
the data property is where all the interesting stuff is happening. For more
details about the structure of HistoricalData responses, consult section A.2.5
in the [Developer's Guide].

```
{ "data":[
    { "securityData":
      { "security": "IBM US Equity",
        "eidData":[],
        "sequenceNumber":0,
        "fieldExceptions":[],
        "fieldData":[{"date":"2012-01-03T00:00:00.000Z","PX_LAST":186.3,"OPEN":186.73},{"date":"2012-01-04T00:00:00.000Z","PX_LAST":185.54,"OPEN":185.57},{"date":"2012-01-05T00:00:00.000Z","PX_LAST":184.66,"OPEN":184.81}]
      }
    },
    { "securityData":
      { "security": "AAPL US Equity",
        "eidData":[],
        "sequenceNumber":1,
        "fieldExceptions":[],
        "fieldData":[{"date":"2012-01-03T00:00:00.000Z","PX_LAST":58.7471,"OPEN":58.4857},{"date":"2012-01-04T00:00:00.000Z","PX_LAST":59.0629,"OPEN":58.5714},{"date":"2012-01-05T00:00:00.000Z","PX_LAST":59.7186,"OPEN":59.2786}]
      }
    }],
  "status":0,
  "message":"OK" }
```


Reference Data Service (//blp/refdata)
======================================

The Reference Data Service provides request/response access to market data. It
supports several kinds of requests, each with its own request parameters and
response types. The sub-sections below describe the different types of
requests/responses that are available via the [HTTP API]. Each request type
also refers to the [Developer's Guide] sections that provide an overview of
that type, as well as the schemas for the request and response. All response
elements that can occur for any of the types are detailed in section A.2.14.


HistoricalData
--------------

Use this request type to get end-of-day data about specific securities over a
range of dates. This request must specify at least one security, at least one
field, and start and end dates.

* Overview: 7.2.2
* Request Schema: A.2.4
* Response Schema: A.2.5

Example request/response were used in the previous section when describing the
HTTP API usage.


ReferenceData
-------------

Use this request type to get current data about specific securities. This
request must specify at least one security and at least one field.

* Overview: 7.2.1
* Request Schema: A.2.2
* Response Schema: A.2.3

Example request/response:

```
curl -X POST 'http://blpapihost.example.com/request?ns=blp&service=refdata&type=ReferenceData' --data @- <<EOF
{ "securities": ["IBM US Equity", "AAPL US Equity"],
  "fields": ["PX_LAST", "NAME", "EPS_ANNUALIZED"] }
EOF

{ "data":[
    { "securityData":[
      { "security":"IBM US Equity",
        "eidData":[],
        "fieldExceptions":[],
        "sequenceNumber":0,
        "fieldData":{"PX_LAST":158.42,"NAME":"INTL BUSINESS MACHINES CORP","EPS_ANNUALIZED":15.06}
      },
      { "security":"AAPL US Equity",
        "eidData":[],
        "fieldExceptions":[],
        "sequenceNumber":1,
        "fieldData":{"PX_LAST":111.89,"NAME":"APPLE INC","EPS_ANNUALIZED":6.49}
      }]
    }],
  "status":0,
  "message":"OK" }
```


API Field Service (//blp/apiflds)
=================================

There are more fields available than can be enumerated in this document.
To search for and get information about fields using a Bloomberg Terminal,
use `FLDS<GO>`. You can also use the HTTP API to query the `/blp/apiflds`
service. The API Field Service allows you to get information about a specific
field as well as search for fields (useful if you want to discover fields, e.g.
if you don't know the name of the field that contains the last price).

This service is detailed in sections 7.6 and A.3 of the [Developer's Guide].


FieldInfo
---------

Use this request type to get information about specific fields. This request
must specify at least one field (using either the id or the mnemonic). To get
the documentation text for the field in addition to the field properties,
specify `"returnFieldDocumentation": "true"`.

* Overview: 7.6.1
* Request Schema: A.3.3
* Response Schema: A.3.3.1

Example request/response:

```
curl -X POST 'http://blpapihost.example.com/request&ns=blp&service=apiflds&type=FieldInfo' --data @- <<EOF
{ "id": ["NAME"],
  "returnFieldDocumentation": "true" }
EOF

{ "data":[
  { "fieldData":[
    { "id":"DS002",
      "fieldInfo":{"mnemonic":"NAME","description":"Name","datatype":"String","documentation":"Name of the company or brief description of the security. For returns over 30 characters long, Long Company Name (DS520, LONG_COMP_NAME) may provide the full name. For funds, the name of the fund along with the share class will be returned, if there are multiple share classes available.\n\nEquities:\nName of the company, limited to the first 28 characters. Long Company Name (DS520, LONG_COMP_NAME) may provide the full name.","categoryName":[],"property":[],"overrides":[],"ftype":"Character"}
    }]
  }],
  "status":0,
  "message":"OK" }
```
