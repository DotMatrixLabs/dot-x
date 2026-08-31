type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

/**
 * IANA timezone identifiers, read from the JS runtime's own tz database so the
 * list stays current without a hand-maintained copy. Returns an empty array on
 * runtimes without `Intl.supportedValuesOf` (predates Chromium 99 / 2022).
 */
export function getTimezones(): string[] {
  const intl = Intl as IntlWithSupportedValues;
  return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [];
}
