/**
 *  Lookup - validate a phone number
 *
 *  This function will tell you whether or not a phone number is valid using Twilio's Lookup API
 *
 *  Parameters:
 *  "phone" - string - phone number in E.164 format (https://www.twilio.com/docs/glossary/what-e164)
 */

// eslint-disable-next-line consistent-return
exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');

  /*
   * uncomment to support CORS
   * response.appendHeader('Access-Control-Allow-Origin', '*');
   * response.appendHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
   * response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
   */

  try {
    if (event.phone === '' || typeof event.phone === 'undefined') {
      throw new Error('Missing parameter; please provide a phone number.');
    }

    const types = typeof event.types === 'object' ? event.types : [event.types];
    const client = context.getTwilioClient();

    const resp = await client.lookups
      .phoneNumbers(event.phone)
      .fetch({ type: types });

    if (types.includes('lti')) {
      const { lineTypeIntelligence } = await client.lookups.v2
        .phoneNumbers(event.phone)
        .fetch({ fields: 'line_type_intelligence' });

      resp.lineTypeIntelligence = lineTypeIntelligence;
    }

    response.setStatusCode(200);
    response.setBody(resp);
    return callback(null, response);
  } catch (error) {
    console.error(error.message);
    response.setStatusCode(error.status || 400);
    response.setBody({ error: error.message });
    return callback(null, response);
  }
};
