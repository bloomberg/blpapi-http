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

    public static void main(String[] args) {

        try {
            KeyStore clientStore = KeyStore.getInstance("PKCS12");
            clientStore.load(new FileInputStream("client.p12"),
                    "secure".toCharArray());

            KeyManagerFactory kmf = KeyManagerFactory
                .getInstance(KeyManagerFactory.getDefaultAlgorithm());
            kmf.init(clientStore, "secure".toCharArray());
            KeyManager[] kms = kmf.getKeyManagers();

            KeyStore trustStore = KeyStore.getInstance("JKS");
            trustStore.load(new FileInputStream("bloomberg.jks"),
                    "secure2".toCharArray());

            TrustManagerFactory tmf = TrustManagerFactory
                .getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(trustStore);
            TrustManager[] tms = tmf.getTrustManagers();

            SSLContext sslContext = null;
            sslContext = SSLContext.getInstance("TLS");
            sslContext.init(kms, tms, new SecureRandom());

            HttpsURLConnection.setDefaultSSLSocketFactory(sslContext
                    .getSocketFactory());
            URL url = new URL(
                    "https://http-api.openbloomberg.com/request/blp/refdata/ReferenceData");

            HttpsURLConnection urlConn = (HttpsURLConnection) url
                .openConnection();

            urlConn.setRequestMethod("POST");
            urlConn.setRequestProperty("User-Agent", "noname");
            urlConn.setRequestProperty("Accept-Language", "en-US,en;q=0.5");
            urlConn.setDoOutput(true);
            urlConn.setRequestProperty("Content-Type",
                    "application/json; charset=utf8");
            DataOutputStream wr = new DataOutputStream(
                    urlConn.getOutputStream());
            String jsonReq = "{\"securities\": [ \"IBM US Equity\" ], "
                    + "    \"fields\": [\"DY651\"] } ";
            wr.writeBytes(jsonReq);
            wr.flush();
            wr.close();

            int responseCode = urlConn.getResponseCode();
            System.out.println("\nSending 'POST' request to URL : " + url);
            System.out.println("Post parameters : " + jsonReq);
            System.out.println("Response Code : " + responseCode);

            BufferedReader in = new BufferedReader(new InputStreamReader(
                        urlConn.getInputStream()));
            String inputLine;
            StringBuffer response = new StringBuffer();

            while ((inputLine = in.readLine()) != null) {
                response.append(inputLine);
            }
            in.close();

            System.out.println(response.toString());
        } catch (Exception e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

    }

}
