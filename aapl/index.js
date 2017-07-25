const log = require('better-logs')('aapl');
const request = require('request');

const ticker = 'aapl';
const tenYearsAgo = new Date(new Date().setYear(2007));
const date10YearsAgo = `${tenYearsAgo.getFullYear()}${tenYearsAgo.getMonth()}${tenYearsAgo.getDate()}`;
const uri = `https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json?ticker=${ticker}&api_key=zxCetVBktUboxxM9fbCu&date.gt=${date10YearsAgo}`;
request.get(uri, { json: true }, (err, resp, body) => {
  if (err) {
    log.error(err);
    return;
  } else if (resp.statusCode >= 400) {
    log.error(body);
    return;
  }
  log.debug(resp.headers);
  log.debug(body);

});
