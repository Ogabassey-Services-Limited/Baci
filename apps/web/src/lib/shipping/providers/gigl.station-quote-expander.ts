import type { QuoteRequest, ShippingQuote } from '../types';
import type { GiglQuoteIo } from './gigl.constants';
import type { GiglServiceCentre, GiglStation } from './gigl.schemas';
import { expandGiglServiceCentreQuotes } from './gigl.service-centre-quotes';

interface StationQuoteExpanderOptions {
  directoryCentres?: GiglServiceCentre[];
  fetchLiveCentres: () => Promise<GiglServiceCentre[]>;
  generateQuoteId: GiglQuoteIo['generateQuoteId'];
  log: GiglQuoteIo['log'];
  receiver: QuoteRequest['receiver'];
  receiverStation: GiglStation;
}

export function createGiglStationQuoteExpander(
  options: StationQuoteExpanderOptions
): (quote: ShippingQuote) => Promise<ShippingQuote[]> {
  return (quote) =>
    expandGiglServiceCentreQuotes({
      baseQuote: quote,
      fetchServiceCentres: () =>
        options.directoryCentres?.length
          ? Promise.resolve(options.directoryCentres)
          : options.fetchLiveCentres(),
      generateQuoteId: options.generateQuoteId,
      log: options.log,
      receiver: options.receiver,
      receiverStation: options.receiverStation,
    });
}
