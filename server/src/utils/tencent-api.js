const crypto = require('crypto');
const https = require('https');

/**
 * Calculates Tencent Cloud API v3 Signature (TC3-HMAC-SHA256)
 */
function sign(secretId, secretKey, service, action, version, region, payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().split('T')[0];
  
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  
  // Sort and canonicalize headers
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${service}.tencentcloudapi.com\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  
  const hashedPassword = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPassword}`;

  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  // Signature chain
  const kDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    authorization,
    timestamp
  };
}

/**
 * Executes a Tencent Cloud API v3 Request
 */
function request(options) {
  const { secretId, secretKey, service, action, version, region, payload } = options;
  const { authorization, timestamp } = sign(secretId, secretKey, service, action, version, region, payload);

  const requestBody = JSON.stringify(payload);
  const reqOptions = {
    method: 'POST',
    hostname: `${service}.tencentcloudapi.com`,
    path: '/',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': `${service}.tencentcloudapi.com`,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': region,
      'Authorization': authorization
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

module.exports = {
  request
};
