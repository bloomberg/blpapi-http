.PHONY:all clean

all:ReferenceData.class

ReferenceData.class:ReferenceData.java bloomberg.jks client.p12
	$(JAVA_HOME)/bin/javac ReferenceData.java

client.p12:client.crt bloomberg.crt
	openssl pkcs12 -export -password pass:secure -in client.crt -CAfile bloomberg.crt -inkey client.key -out client.p12

bloomberg.jks:bloomberg.crt
	$(JAVA_HOME)/bin/keytool -import -keystore bloomberg.jks -storepass secure2 -trustcacerts -file bloomberg.crt -noprompt

clean:
	$(RM) ReferenceData.class client.p12 bloomberg.jks
