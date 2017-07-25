const assert = require('assert');
const csvParse = require('csv-parse');
const fs = require('fs');
const log = require('better-logs')('aapl on margin');

const aapl = fs.readFileSync('./aapl/aapl.csv', 'utf8');
// const aaplSplit = fs.readFileSync('./aapl/aapl split.csv', 'utf8');
// const aaplDividend = fs.readFileSync('./aapl/aapl dividend.csv', 'utf8');
const ONE_DAY = 1000 * 60 * 60 * 24;

csvParse(aapl, { auto_parse: true, auto_parse_date: true, columns: true }, (aaplErr, result) => {
  // csvParse(aaplSplit, { auto_parse: true, auto_parse_date: true, columns: true }, (aaplSplitErr, result2) => {
    // csvParse(aaplDividend, { auto_parse: true, auto_parse_date: true, columns: true }, (aaplDividendErr, result3) => {
      if (aaplErr) {//} || aaplSplitErr || aaplDividendErr) {
        log.error('failed to parse.', aaplErr); //, aaplSplitErr, aaplDividendErr);
        process.exit(1);
      }

      // const divMapping = {};
      // result3.forEach((row) => {
      //   divMapping[row.Date] = row.Dividends;
      // });

      const monthlyContrib = 5000;
      let totalContrib = 0;
      let leftover = 0;
      let numStocks = 0;
      let divEarnings = 0;

      let prevSMA = 0;
      let elv = 0;
      let prevClose = result[0].Close;

      let marginPercent = 1;

      for (let index = 0; index < result.length; index++) {
        row = result[index];
        if (!row) return;
        // const div = divMapping[row.Date];
        // if (div) {
        //   log.debug('we got a dividend of:', div)
        //   leftover += numStocks * div;
        //   divEarnings += numStocks * div;
        //   elv += numStocks * div;
        // }

        if (index % 4 === 0) {
          totalContrib += monthlyContrib;
          const moneyToSpend = monthlyContrib + leftover;
          const stockPrice = row.Close * marginPercent;
          const stocksBought = Math.floor(moneyToSpend / stockPrice);
          // log.debug('numEtfsBought:', numEtfsBought)
          // log.debug('extraEtfsBought:', extraEtfsBought)
          // log.debug('leftover:', leftover);
          leftover = moneyToSpend % stockPrice;
          numStocks += stocksBought;
          elv += monthlyContrib;
        }

        const smv = numStocks * row.Close + leftover;
        elv += (numStocks * (row.Close - prevClose));
        const intialMargin = .25 * numStocks * row.Close;
        const maintenanceMargin = .25 * numStocks * row.Close;
        const availableFunds = elv - intialMargin;
        let excessLiquidity = elv - maintenanceMargin;
        const regTMargin = .5 * numStocks * row.Close;
        let sma = Math.max(prevSMA + (index % 4 === 0 ? monthlyContrib : 0) - regTMargin, elv - regTMargin);

        // log.debug({ smv, elv, intialMargin, maintenanceMargin, availableFunds, excessLiquidity, regTMargin, sma, prevSMA, prevClose, close: row.Close, contrib: index % 2 === 0 ? monthlyContrib : 0 });
        if (sma < 0) {
          // sell until elv === regTMargin
          // TODO where does leftover come into play?
          const etfsToSell = Math.ceil((-sma - leftover) / row.Close);
          leftover = 0;
          numStocks -= etfsToSell;
          leftover = etfsToSell * row.Close - ((-sma - leftover) / row.Close) * row.Close;
          log.debug('MARGIN CALL')
          log.debug('selling:', etfsToSell, etfsToSell * row.Close, leftover)
          sma = 0;
        } else if (excessLiquidity < 0) {
          const etfsToSell = Math.ceil((-excessLiquidity - leftover) / row.Close);
          leftover = 0;
          numStocks -= etfsToSell;
          leftover = etfsToSell * row.Close - ((-excessLiquidity - leftover) / row.Close) * row.Close;
          excessLiquidity = 0;
          log.debug('MARGIN CALL')
          log.debug('selling:', etfsToSell, etfsToSell * row.Close, leftover)
          assert(false)
        }
        prevSMA = sma;
        prevClose = row.Close;
      };

      const totalReturn = numStocks * result[result.length - 1].Close;
      const interestGain = totalReturn / totalContrib;
      const oneYear = 1000 * 60 * 60 * 24 * 365;
      const yearsInvested = (result[result.length - 1].Date - result[0].Date) / oneYear;

      log.debug('total stocks:', numStocks)
      log.debug('total money:', totalReturn)
      log.debug('total contributions:', totalContrib)
      log.debug('earnings on dividends:', divEarnings);
      log.debug('date range:', result[0].Date, result[result.length - 1].Date);
      log.debug(`interest gained: ${(interestGain * 100).toFixed(2)}%, $${(totalReturn - totalContrib).toFixed(2)}`);
      log.debug('years invested:', yearsInvested);
      log.debug('average roi per year:', interestGain / yearsInvested);
    // });
  // });
});
