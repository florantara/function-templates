const samlp = require('samlp');
const fs = require('fs');

function SimpleProfileMapper(pu) {
  if (!(this instanceof SimpleProfileMapper)) {
    return new SimpleProfileMapper(pu);
  }
  this._pu = pu;
}

SimpleProfileMapper.prototype.metadata = [
  {
    id: 'userName',
    optional: false,
    displayName: 'SSO Username',
    description: 'The SSO Username',
    multiValue: false,
  },
];

SimpleProfileMapper.fromMetadata = function (metadata) {
  function CustomProfileMapper(user) {
    if (!(this instanceof CustomProfileMapper)) {
      return new CustomProfileMapper(user);
    }
    SimpleProfileMapper.call(this, user);
  }
  CustomProfileMapper.prototype = Object.create(SimpleProfileMapper.prototype);
  CustomProfileMapper.prototype.metadata = metadata;
  return CustomProfileMapper;
};

SimpleProfileMapper.prototype.getClaims = function () {
  const that = this;
  const claims = {};

  this.metadata.forEach(function (entry) {
    claims[entry.id] = entry.multiValue
      ? that._pu[entry.id].split(',')
      : that._pu[entry.id];
  });

  return Object.keys(claims).length && claims;
};

SimpleProfileMapper.prototype.getNameIdentifier = function () {
  return {
    nameIdentifier: this._pu.userName,
    nameIdentifierFormat: this._pu.nameIdFormat,
    nameIdentifierNameQualifier: this._pu.nameIdNameQualifier,
    nameIdentifierSPNameQualifier: this._pu.nameIdSPNameQualifier,
    nameIdentifierSPProvidedID: this._pu.nameIdSPProvidedID,
  };
};

function validateLogin(event, context, callback) {
  const { password, userName } = event;
  const { SSO_USERNAME, SSO_PASSWORD, SSO_REALM_SID } = context;

  if (!userName) {
    return callback(new Error('Missing userName'));
  }
  if (!password) {
    return callback(new Error('Missing password'));
  }
  if (!SSO_REALM_SID) {
    return callback(new Error('Missing SSO_REALM_SID'));
  }
  if (password !== SSO_PASSWORD) {
    return callback(new Error('Invalid password'));
  }
  if (userName !== SSO_USERNAME) {
    return callback(new Error('Invalid username'));
  }
  return true;
}

exports.handler = async function (context, event, callback) {
  const { userName, RelayState } = event;
  const { SSO_REALM_SID } = context;

  validateLogin(event, context, callback);

  // eslint-disable-next-line no-warning-comments
  const ISSUER = 'frontline-demo-idp'; // TODO: make this dynamic and show value on Success page

  const audience = `https://iam.twilio.com/v2/saml2/metadata/${SSO_REALM_SID}`;
  const acsUrl = `https://iam.twilio.com/v2/saml2/authenticate/${SSO_REALM_SID}`;

  // eslint-disable-next-line no-warning-comments
  // TODO: generate new certificates at build time and consume here:
  const publicCertFile =
    Runtime.getAssets()['/sso-demo/idp-public-cert.pem'].path;
  const publicCert = fs.readFileSync(publicCertFile, 'utf8');
  const privateKeyFile =
    Runtime.getAssets()['/sso-demo/idp-private-key.pem'].path;
  const privateKey = fs.readFileSync(privateKeyFile, 'utf8');

  samlp.parseRequest(event, function (err, data) {
    if (err) {
      return callback(err);
    }

    const authOptions = {
      issuer: ISSUER,
      cert: publicCert,
      key: privateKey,
      audience,
      recipient: acsUrl,
      destination: acsUrl,
      acsUrl,
      RelayState,

      // get the url to post the token to:
      getPostURL(audience, authnRequestDom, req, callback) {
        return callback(null, acsUrl);
      },

      getUserFromRequest() {
        return {
          userName,
          nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
          roles: 'manager',
        };
      },
      signResponse: true,
      profileMapper: SimpleProfileMapper.fromMetadata([
        {
          id: 'roles',
          optional: false,
          displayName: 'Roles',
          description: 'The type of user',
          options: ['manager'],
        },
      ]),
    };

    try {
      const res = new Twilio.Response();
      res.set = res.appendHeader;
      res.send = (samlResponse) => {
        res.setBody(samlResponse);
        return callback(null, res);
      };

      return samlp.auth(authOptions)(event, res, callback);
    } catch (error) {
      console.log('ERROR in SSO Login', error);
      return callback({ error: error.message });
    }
  });
};
