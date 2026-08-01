import 'server-only';
import {
  DEFAULT_INDEXNOW_ENDPOINT,
  DEFAULT_INDEXNOW_KEY,
  submitIndexNowUrls,
} from './indexnow';

type SubmitConfiguredIndexNowUrlsOptions = {
  host: string;
  urls: string[];
};

/** Runs IndexNow submission with credentials that are only reachable on the server. */
export function submitConfiguredIndexNowUrls({
  host,
  urls,
}: SubmitConfiguredIndexNowUrlsOptions) {
  return submitIndexNowUrls({
    endpoint:
      process.env.INDEXNOW_ENDPOINT?.trim() || DEFAULT_INDEXNOW_ENDPOINT,
    host,
    key: process.env.INDEXNOW_KEY?.trim() || DEFAULT_INDEXNOW_KEY,
    urls,
  });
}
