export const MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY = `
SELECT
  toString(toDate(toTimeZone(timestamp, 'UTC'))) AS day,
  event,
  if(
    event = 'mobile_onboarding_contract_invoked',
    toString(properties.contract),
    'canary'
  ) AS contract,
  count() AS total
FROM events
WHERE timestamp >= toStartOfDay(toTimeZone(now(), 'UTC')) - INTERVAL 8 DAY
  AND timestamp < toStartOfDay(toTimeZone(now(), 'UTC'))
  AND event IN (
    'mobile_onboarding_contract_invoked',
    'mobile_onboarding_contract_telemetry_canary'
  )
GROUP BY day, event, contract
ORDER BY day ASC, event ASC, contract ASC
`.trim();
