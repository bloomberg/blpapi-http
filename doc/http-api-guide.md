# HTTP API

The [Bloomberg Open API] provides access to market data. The [Bloomberg HTTP
API] makes the [Open API] available via HTTP and WebSockets.  Clients may
access reference and historical request/response data as well as make
subscriptions for live data.

This document provides an overview of the [HTTP API]: the URLs to use, the
formatting for the HTTP request/response, and the formatting for WebSocket
subscriptions.  Bloomberg operates a server at
https://http-api.openbloomberg.com/ that runs an instance of this API for demo
and other purposes (e.g., hackathons). All examples in this document, as well
as elsewhere in this project, are written to work with this server (e.g., they
use client certificates for authentication/identity).

This document also includes basic information about some of the underlying
[Open API] operations. For more details on the [Open API], refer to the
[BLPAPI Developer's Guide]. Where appropriate, this document will refer to
specific sections of the [Developer's Guide].

The [HTTP API] is currently in development and future versions may add or
change functionality. For example, additional authentication options may become
available in the future.

[Bloomberg Open API]: http://bloomberglabs.com/api
[Open API]: http://bloomberglabs.com/api
[Bloomberg HTTP API]: http://github.com/bloomberg/blpapi-http
[HTTP API]: http://github.com/bloomberg/blpapi-http
[BLPAPI Developer's Guide]: http://www.bloomberglabs.com/files/2014/07/blpapi-developers-guide-2.54.pdf
[Developer's Guide]: http://www.bloomberglabs.com/files/2014/07/blpapi-developers-guide-2.54.pdf

## Table of Contents

  * [Request/Response data](#requestresponse-data)
    * [HTTP request headers](#http-request-headers)
    * [HTTP response format](#http-response-format)
    * [Reference Data Service](#reference-data-service-blprefdata)
      * [HistoricalData](#historicaldata)
      * [ReferenceData](#referencedata)
    * [API Field Service](#api-field-service-blpapiflds)
      * [FieldInfo](#fieldinfo)
  * [Subscription data](#subscription-data)
    * [WebSocket and SocketIO message types](#websocket-and-socketio-message-types)
      * [Client to Server](#client-to-server)
      * [Server to Client](#server-to-client)
    * [Long-Polling API details](#long-polling-api-details)
    * [Subscriptions over WebSockets](#subscriptions-over-websockets)
    * [Subscriptions over SocketIO](#subscriptions-over-socketio)
    * [Subscriptions over Long-Polling](#subscriptions-over-long-polling)


## Request/Response data

Clients access services that use the request/response paradigm via a HTTP post
to the path `/request`:

```
https://http-api.openbloomberg.com/request?ns=<namespace>&service=<service>&type=<requestType>
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
curl -X POST 'https://http-api.openbloomberg.com/request?ns=blp&service=refdata&type=HistoricalDataRequest' \
    --cacert bloomberg.crt \
    --cert   client.crt    \
    --key    client.key    \
    --data @- <<EOF
{ "securities": ["IBM US Equity", "AAPL US Equity"],
  "fields": ["PX_LAST", "OPEN"],
  "startDate": "20120101",
  "endDate": "20120105",
  "periodicitySelection": "DAILY" }
EOF
```


### HTTP request headers

The client may specify the following HTTP request headers to inform the server
of its capabilities in handling the response:

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


### HTTP response format

The HTTP response message body consists of a JSON object with the following
properties:

* `status`: If we successfully communicated with the Open API, this will be 0.
  Otherwise, it will contain details about the error.
* `message`: If we successfully communicated with the Open API, this will be
  "OK". Otherwise, it will contain a description of the error.
* `data`: The response from the Open API (only present if `"message": "OK"`).
  The exact structure of this value depends on the operation, and is detailed
  in section A.2.14 of the [Developer's Guide].

Note that `"message": "OK"` doesn't necessarily mean that the request
successfully got useful data. If the HTTP server successfully makes the Open
API call but there was an error in executing the operation (e.g., because a
required parameter for that operation was not specified), then `"status": 0`
and `"message": "OK"` but the data returned from the API will contain an error
(e.g., in a `responseError` property of the data, or a `securityError` property
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


### Reference Data Service (//blp/refdata)

The Reference Data Service provides request/response access to market data. It
supports several kinds of requests, each with its own request parameters and
response types. The sub-sections below describe the different types of
requests/responses that are available via the [HTTP API]. Each request type
also refers to the [Developer's Guide] sections that provide an overview of
that type, as well as the schemas for the request and response. All response
elements that can occur for any of the types are detailed in section A.2.14.


#### HistoricalData

Use this request type to get end-of-day data about specific securities over a
range of dates. This request must specify at least one security, at least one
field, and start and end dates.

* Overview: 7.2.2
* Request Schema: A.2.4
* Response Schema: A.2.5

Example request/response were used in the previous section when describing the
HTTP API usage.


#### ReferenceData

Use this request type to get current data about specific securities. This
request must specify at least one security and at least one field.

* Overview: 7.2.1
* Request Schema: A.2.2
* Response Schema: A.2.3

Example request/response:

```
curl -X POST 'https://http-api.openbloomberg.com/request?ns=blp&service=refdata&type=ReferenceDataRequest' \
    --cacert bloomberg.crt \
    --cert   client.crt    \
    --key    client.key    \
    --data @- <<EOF
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


### API Field Service (//blp/apiflds)

There are more fields available than can be enumerated in this document.
To search for and get information about fields using a Bloomberg Terminal,
use `FLDS<GO>`. You can also use the HTTP API to query the `/blp/apiflds`
service. The API Field Service allows you to get information about a specific
field as well as search for fields (useful if you want to discover fields,
e.g., if you don't know the name of the field that contains the last price).

This service is detailed in sections 7.6 and A.3 of the [Developer's Guide].


#### FieldInfo

Use this request type to get information about specific fields. This request
must specify at least one field (using either the id or the mnemonic). To get
the documentation text for the field in addition to the field properties,
specify `"returnFieldDocumentation": "true"`.

* Overview: 7.6.1
* Request Schema: A.3.3
* Response Schema: A.3.3.1

Example request/response:

```
curl -X POST 'https://http-api.openbloomberg.com/request&ns=blp&service=apiflds&type=FieldInfoRequest' \
    --cacert bloomberg.crt \
    --cert   client.crt    \
    --key    client.key    \
    --data @- <<EOF
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


## Subscription data

Clients may access subscription data via native WebSockets, SocketIO, or
long-polling over HTTP.

The preferred method to access subscription data is over native WebSockets.
WebSockets is a web standard for receiving event-driven messages without having
to resort to long-polling.  SocketIO is a higher-level library built on top of
WebSockets, which has transparent long-polling fallback support, automatic
reconnection, and the ability to define custom events; however, it is not a
standard and language support is limited to JavaScript at the time of this
writing.  For compatability reasons, long-polling is also supported for clients
that are unable to utilize the WebSocket protocol.

The following sections discuss the details for subscription data over native
WebSockets, SocketIO, and long-polling over HTTP.

### WebSocket and SocketIO message types

When accesing subscription data via native WebSockets or SocketIO, each
mechanism shares the same message types.  Note that when using WebSockets, that
the message comes in the form:

```javascript
{
    'type': /* message type */,
    'data': /* message data */
}
```

Socket.IO takes an event emitter approach, where a client listens on the
different event types.  For example:
```javascript
sockent.on(/* message type */, function(/* message data */) {
});
```

The following sections itemize each mesage type with the corresponding message
data.

#### Client to Server

* `subscribe` - a list of subscriptions to subscribe to

    ```javascript
    // message data
    [
        { security: /* string */, correlationId: /* number */, fields: [/* strings */]},
    ]
    ```
* `unsubscribe` - a list of correlation ids to unsubscribe to

    ```javascript
    // message data
    [ /* numbers */ ] // note that no-array provided implies unsubscribe from everything
    ```

#### Server to Client

* `data` - the payload of the each subscription message

    ```javascript
    // message data
    {
        correlationId: /* number */,
        data: /* JSON payload */
    }
    ```
* `err` - an error if anything goes wrong with a subscription

    ```javascript
    // message data
    {
        message: /* string */
    }
    ```
* `subscribed` - correlation ids that have successfully subscribed

    ```javascript
    // message data
    [
        /* correaltion ids */
    ]
    ```
* `unsubscribe` - correlation ids that have succesfully unsubscribed

    ```javascript
    // message data
    [
        /* correaltion ids */
    ]
    ```

### Long-Polling API details

As a last resort, clients may access subscriptions via the HTTP path
`/subscription`.

`/subscription` can take the following, mutually excluseive, query parameters:

* `action` -- A HTTP POST to control starting and stopping subscriptions.  The body of the post is
  the same as the message data for client => server messages used for WebSockets and Socket.IO  The
  valid query parameter values are:
    * `start`
    * `stop`
* `pollid` -- A HTTP GET to retrieve subscription data.  The value is a logical
  counter that should be increasing, which acts as an implicit acknowledgement
  of received data.

Note that if a GET request with a specified value for `pollid` fails, the `pollid` may be reused to
recover the the last set of buffered subscription data.

### Subscriptions over WebSockets

[examples/node/MarketDataSubscription\_ws.js](../examples/node/MarketDataSubscription_ws.js)

### Subscriptions over SocketIO

[examples/node/MarketDataSubscription\_socketio.js](../examples/node/MarketDataSubscription_socketio.js)

### Subscriptions over Long-Polling

[examples/node/MarketDataSubscription\_LongPoll.js](../examples/node/MarketDataSubscription_LongPoll.js)

