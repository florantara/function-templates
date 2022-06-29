const fs = require('fs');

/**
 * This function is the URL that's setup on the
 * Frontline SSO / Login screen -> SSO URL field
 * and serves the Private login page from assets
 */

module.exports.handler = async function (context, event, callback) {
  try {
  } catch (error) {}
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'text/html');
  response.setStatusCode(200);

  try {
    const loginPath = Runtime.getAssets()['/sso-demo/login.html'].path;
    const loginPage = fs.readFileSync(loginPath, 'utf8');
    response.setBody(loginPage);
  } catch (err) {
    console.error(err);
  }
  callback(null, response);
};
