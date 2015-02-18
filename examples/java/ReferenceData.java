// ReferenceData.java
import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.security.KeyStore;
import java.security.SecureRandom;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.KeyManager;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;

public class ReferenceData {
    public static final String apiUrl = "https://http-api.openbloomberg.com"
        + "/request?ns=blp&service=refdata&type=ReferenceDataRequest";
    public static final String keyStorePW = "secure";
    public static final String trustStorePW = "secure2";
    public static final String clientCert = "client.p12";
    public static final String bbCert = "bloomberg.jks";

    public static void main(String[] args) {

        if (1 > args.length) {
            System.out.println("Usage: ReferenceData <json file>");
            return;
        }
        String jsonFile = args[0];
        try {
            // load the client public/private key from PKCS12
            KeyStore clientStore = KeyStore.getInstance("PKCS12");
            clientStore.load(new FileInputStream(clientCert), keyStorePW.toCharArray());

            KeyManagerFactory kmf = KeyManagerFactory.getInstance(
                KeyManagerFactory.getDefaultAlgorithm());
            kmf.init(clientStore, keyStorePW.toCharArray());
            KeyManager[] kms = kmf.getKeyManagers();

            // load the public key of the CA from JKS,
            // so we can verify the server certificate.
            KeyStore trustStore = KeyStore.getInstance("JKS");
            trustStore.load(new FileInputStream(bbCert), trustStorePW.toCharArray());

            TrustManagerFactory tmf = TrustManagerFactory.getInstance(
                TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(trustStore);
            TrustManager[] tms = tmf.getTrustManagers();

            // initialize the SSLContext with the keys,
            // KeyManager: client public/private key, TrustManager: server public key
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(kms, tms, new SecureRandom());

            HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.getSocketFactory());
            URL url = new URL(apiUrl);

            // open connection to the server
            HttpsURLConnection urlConn = (HttpsURLConnection) url.openConnection();

            urlConn.setRequestMethod("POST");
            urlConn.setRequestProperty("User-Agent", "blpapi-http-java-example");
            urlConn.setRequestProperty("Accept-Language", "en-US,en;q=0.5");
            urlConn.setDoOutput(true);
            urlConn.setRequestProperty("Content-Type", "application/json; charset=utf8");

            // write the json request to the output stream
            DataOutputStream wr = new DataOutputStream(urlConn.getOutputStream());
            FileInputStream fis = new FileInputStream(jsonFile);
            byte[] buffer = new byte[1024];
            int len = fis.read(buffer);
            while (-1 < len) {
                wr.write(buffer, 0, len);
                len = fis.read(buffer);
            }
            wr.flush();
            wr.close();

            // read the whatever we get back
            int responseCode = urlConn.getResponseCode();
            System.out.println("\nSending 'POST' request to URL : " + url);
            System.out.println("Response Code : " + responseCode);

            BufferedReader in = new BufferedReader(new InputStreamReader(urlConn.getInputStream()));
            String inputLine;
            StringBuffer response = new StringBuffer();

            while ((inputLine = in.readLine()) != null) {
                response.append(inputLine);
            }
            in.close();

            System.out.println(response.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
