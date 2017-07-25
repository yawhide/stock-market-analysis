const assert = require('assert');
const csvParse = require('csv-parse');
const fs = require('fs');
const log = require('better-logs')('vti on margin');

const vti = fs.readFileSync('./vti/VTI.csv', 'utf8');
const vtiSplit = fs.readFileSync('./vti/VTI split.csv', 'utf8');
const vtiDividend = fs.readFileSync('./vti/VTI dividend.csv', 'utf8');
const ONE_DAY = 1000 * 60 * 60 * 24;

csvParse(vti, { auto_parse: true, auto_parse_date: true, columns: true }, (vtiErr, result) => {
  csvParse(vtiSplit, { auto_parse: true, auto_parse_date: true, columns: true }, (vtiSplitErr, result2) => {
    csvParse(vtiDividend, { auto_parse: true, auto_parse_date: true, columns: true }, (vtiDividendErr, result3) => {
      if (vtiErr || vtiSplitErr || vtiDividendErr) {
        log.error('failed to parse.', vtiErr, vtiSplitErr, vtiDividendErr);
        process.exit(1);
      }

      const divMapping = {};
      result3.forEach((row) => {
        divMapping[row.Date] = row.Dividends;
      });

      const monthlyContrib = 5000;
      let leftover = 0;
      let numEtfs = 0;
      let divEarnings = 0;

      let prevSMA = 0;
      let elv = 0;
      let prevClose = result[0].Close;

      for (let index = 0; index < result.length; index++) {
        row = result[index];
        if (!row) return;
        const div = divMapping[row.Date];
        if (div) {
          log.debug('we got a dividend of:', div)
          leftover += numEtfs * div;
          divEarnings += numEtfs * div;
          elv += numEtfs * div;
        }

        if (index % 4 === 0) {
          const numEtfsBought = Math.floor(monthlyContrib / (row.Close * .5));
          log.debug('numEtfsBought:', numEtfsBought)
          leftover += monthlyContrib - numEtfsBought * (row.Close * .5);
          const extraEtfsBought = Math.floor(leftover / (row.Close * .5));
          log.debug('extraEtfsBought:', extraEtfsBought)
          leftover -= extraEtfsBought * (row.Close * .5);
          numEtfs += numEtfsBought + extraEtfsBought;
          log.debug('leftover:', leftover);
          elv += monthlyContrib;
        }

        const smv = numEtfs * row.Close + leftover;
        elv += (numEtfs * (row.Close - prevClose));
        const intialMargin = .25 * numEtfs * row.Close;
        const maintenanceMargin = .25 * numEtfs * row.Close;
        const availableFunds = elv - intialMargin;
        let excessLiquidity = elv - maintenanceMargin;
        const regTMargin = .5 * numEtfs * row.Close;
        let sma = Math.max(prevSMA + (index % 4 === 0 ? monthlyContrib : 0) - regTMargin, elv - regTMargin);

        log.debug({ smv, elv, intialMargin, maintenanceMargin, availableFunds, excessLiquidity, regTMargin, sma, prevSMA, prevClose, close: row.Close, contrib: index % 2 === 0 ? monthlyContrib : 0 });
        if (sma < 0) {
          // sell until elv === regTMargin
          // TODO where does leftover come into play?
          const etfsToSell = Math.ceil((-sma - leftover) / row.Close);
          leftover = 0;
          numEtfs -= etfsToSell;
          leftover = etfsToSell * row.Close - ((-sma - leftover) / row.Close) * row.Close;
          log.debug('MARGIN CALL')
          log.debug('selling:', etfsToSell, etfsToSell * row.Close, leftover)
          sma = 0;
        } else if (excessLiquidity < 0) {
          const etfsToSell = Math.ceil((-excessLiquidity - leftover) / row.Close);
          leftover = 0;
          numEtfs -= etfsToSell;
          leftover = etfsToSell * row.Close - ((-excessLiquidity - leftover) / row.Close) * row.Close;
          excessLiquidity = 0;
          log.debug('MARGIN CALL')
          log.debug('selling:', etfsToSell, etfsToSell * row.Close, leftover)
          assert(false)
        }
        prevSMA = sma;
        prevClose = row.Close;
      };

      const totalReturn = numEtfs * result[result.length - 2].Close;
      const totalContrib = result.length / 4 * monthlyContrib;

      log.debug('total etfs:', numEtfs)
      log.debug('total money:', totalReturn)
      log.debug('total contributions:', totalContrib)
      log.debug('earnings on dividends:', divEarnings);
      log.debug(result[result.length - 1].Date, result[0].Date)
      log.debug('average roi per year:', (totalReturn / totalContrib) / ((result[result.length - 1].Date - result[0].Date) / (1000 * 60 * 60 * 24 * 365)));
    });
  });
});
