JavaScript implementation of JSON Web Signatures and JSON Web Tokens, especially as needed by BrowserID.

- libs contains third-party libraries that need to be included. See
libs/dependencies.txt and libs/package.txt

- This is written as CommonJS modules for node and
  such. Browserify is used to bundle it all up.

NOTE: this is written as future documentation of v0.2 APIs, which will not
be backwards compatible with v0.1.

Overview
===

JSON Web Tokens (JWTs) look like:

   eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9
   .
   eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFt
   cGxlLmNvbS9pc19yb290Ijp0cnVlfQ
   .
   dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk

(line breaks are for readability)

JWTs are made up of three components, each base64url-encoded, joined by a period character. A JWT can be either a JWS (JSON Web Signature) or a JWE (JSON Web Encryption). In this library, we only consider JWS. Because JWT is effectively the abstract superclass of both JWS and JWE, we don't expose JWT APIs directly (as of v0.2.0). We simply expose a JWS API.

We use JWK (JSON Web Keys) to specify keys:
http://tools.ietf.org/html/draft-ietf-jose-json-web-key-00

We use JWA (JSON Web Algorithms) to specify algorithms:
http://tools.ietf.org/html/draft-ietf-jose-json-web-algorithms-00
(we add algorithm "DS" to indicate DSA, with DS160 the standard DSA 1024/160.)

API
===

    var jwcrypto = require("jwcrypto");

    // a Random Number Generator is expected to provide the following interface
    // rng.nextBytes(byteArray);
    // where byteArray will then be filled in with random bytes.
    // seeding of the rng is left to the RNG implementation.
    var rng; // initialize this thing

    // generate a key
    jwcrypto.JWK.generateKeypair({
        algorithm: jwcrypto.JWA.DS, // this is just 'DS'
        size: 256
    }, rng, function(err, keypair) {
        // error in err?

        // serialize the public key
        console.log(keypair.publicKey.toString());

        // just the JSON object to embed in another structure
        console.log(JSON.stringify({stuff: keypair.publicKey.toJSONObject()}));


        // create and sign a JWS
        jwcrypto.JWS.create({
           principal: {email: 'some@dude.domain'},
           pubkey: jwcrypto.JWK.fromString(publicKeyToCertify)
        }, keypair.secretKey, function(err, jws) {
           // error in err?

           // serialize it
           console.log(jws.toString());
        });

        // parse a JWS
        var jws = jwcrypto.JWS.fromString(submittedJWS);

        // payload and header are immediately populated as objects
        console.log(JSON.stringify(jws.payload));
        console.log(JSON.stringify(jws.header));

        // verify it
        jws.verify(publicKey, function(err, isVerified) {
          // if verification fails, then isVerified is false
          // and err is populated with error string.
        });

    });
