# Java examples

This example is a Java https client focusing on two points:
  * converting and loading PEM certificates
  * sending json in a POST request over the https connection

## Build

This has been tested on Linux and Cygwin.

1. Required files:
  * client.crt: PEM certificate, the public key
  * client.key: PEM RSA private key
  * bloomberg.crt: CA certificate

2. Make sure your PATH has got these:
  * openssl
  * keytool: part of JDK
  * javac, java

3. Build:

```
$ make all
```
4. Output:
  * client.p12: PKCS12 certificate holding the `client.key` and `client.crt`
protected by password: `secure`. This is used by the KeyManager.
  * bloomberg.jks: java key store holding the CA certificate, used by the
TrustManager. Password protected: `secure2`.
  * ReferenceData.class

## Run

```
$ java ReferenceData ../examples/ReferenceData/IBMHolders.json
```
