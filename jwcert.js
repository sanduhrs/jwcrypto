/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is trusted.js; substantial portions derived
 * from XAuth code originally produced by Meebo, Inc., and provided
 * under the Apache License, Version 2.0; see http://github.com/xauth/xauth
 *
 * Contributor(s):
 *     Ben Adida <benadida@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

//
// certs based on JWS
//

// a sample JWCert:
//
// {
//   iss: "example.com",
//   exp: "1313971280961",
//   iat: "1313971259361",
//   public-key: {
//     alg: "RS256",
//     value: "-----BEGIN PUBLIC KEY-----MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAIn8oZeKoif0us1CTj12zGveebf1FfEmlBW2Gh38kejVP2fSgjSWtMuHzzCcQuWwxCe3M5L5My9BgOtcsyQCzpECAwEAAQ==-----END PUBLIC KEY-----"
//   },
//   principal: {
//     email: "john@example.com"
//   }
// }
//
//
// for intermediate certificates, fake subdomains of the issuer can be used,
// with a different type of principal
//
// {
//   iss: "example.com",
//   exp: "1313971280961",
//   iat: "1313971259361",
//   public-key: {
//     alg: "RS",
//     value: "-----BEGIN PUBLIC KEY-----MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAIn8oZeKoif0us1CTj12zGveebf1FfEmlBW2Gh38kejVP2fSgjSWtMuHzzCcQuWwxCe3M5L5My9BgOtcsyQCzpECAwEAAQ==-----END PUBLIC KEY-----"
//   },
//   principal: {
//     host: "intermediate1.example.com"
//   }
// }

var libs = require("./libs/all"),
    utils = require("./utils"),
    jwk = require("./jwk"),
    jws = require("./jws"),
    und = require("./underscore.js");

function JWCert(issuer, expires, issued_at, pk, principal) {
  this.init(issuer, expires, issued_at, pk, principal);
};

JWCert.prototype = new jws.JWS();

// add some methods

JWCert.prototype.init = function(issuer, expires, issued_at, pk, principal) {
  this.issuer = issuer;
  this.expires = expires;
  this.issued_at = issued_at;
  this.pk = pk;
  this.principal = principal;
};

JWCert.prototype.serializePayload = function() {
  return JSON.stringify({
    iss: this.issuer,
    exp: this.expires ? this.expires.valueOf() : null,
    iat: this.issued_at ? this.issued_at.valueOf() : null,
    "public-key": this.pk.toSimpleObject(),
    principal: this.principal
  });
};

// this is called automatically by JWS
// after verification
JWCert.prototype.deserializePayload = function(payload) {
  var obj = JSON.parse(payload);
  var exp = new Date();
  exp.setTime(obj.exp);

  var iat = null;
  if (obj.iat) {
    iat = new Date();
    iat.setTime(obj.iat);
  }

  var pk = jwk.PublicKey.fromSimpleObject(obj['public-key']);

  this.init(obj.iss, exp, iat, pk, obj.principal);
};

// a utility function to verify a chain of certificates
// where each certificate is serialized
// rootCB is a callback function that fetches the necessary
// root PK given the issuer domain. It is given a continuation parameter
//
// if the chain verifies, the last public key is returned
// if the chain does not verify, null is returned (FIXME: throw an exception?)
JWCert.verifyChain = function(listOfSerializedCert, validUntil, rootCB, successCB, errorCB) {
  // parse all the certs
  var certs = und.map(listOfSerializedCert, function(serializedCert) {
    var c = new JWCert();
    c.parse(serializedCert);
    return c;
  });

  // figure out issuer of first cert
  var root_issuer = certs[0].issuer;

  // fetch the root pk and continue
  rootCB(root_issuer, function(root_pk) {
    // if no root pk, stop now
    if (!root_pk)
      return errorCB("no root PK found");
    
    var current_pk = root_pk;
    var current_principal = null;
    var goodsig = true;
    var fresh = true;

    // loop through certs
    und.each(certs, function(cert) {
      // is the cert expired?
      if (cert.expires < validUntil) {
        fresh = false;
      } else {
        // verify the cert only if it's valid
        if (!cert.verify(current_pk))
          goodsig = false;
      }
      
      // next pk to check
      current_pk = cert.pk;
      current_principal = cert.principal;
    });
    
    if (!goodsig)
      return errorCB("bad signature in chain");
    
    if (!fresh)
      return errorCB("expired cert in chain");
  
    // return last certified public key
    successCB(current_pk, current_principal);
  });
};

exports.JWCert = JWCert;

