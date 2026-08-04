function clean(value) {
  return String(value || '').trim();
}

function composeAddress({ street, city, state, pin, address }) {
  if (street || city || state || pin) {
    return [street, [city, state].filter(Boolean).join(', '), pin ? `PIN ${pin}` : '']
      .map((part) => clean(part))
      .filter(Boolean)
      .join('\n');
  }
  return clean(address);
}

/**
 * Normalize billing fields collected at admin registration for invoices.
 */
function normalizeBillingProfile(input = {}) {
  const phone = clean(input.phone || input.billingPhone);
  const street = clean(input.street);
  const city = clean(input.city);
  const state = clean(input.state);
  const pin = clean(input.pin);
  const address = composeAddress({
    street,
    city,
    state,
    pin,
    address: input.address || input.billingAddress,
  });
  const chargeGstExplicit = input.chargeGst;
  const chargeGst =
    chargeGstExplicit === false || chargeGstExplicit === 'false'
      ? false
      : chargeGstExplicit === true || chargeGstExplicit === 'true'
        ? true
        : typeof chargeGstExplicit === 'boolean'
          ? chargeGstExplicit
          : true;
  const gstin = chargeGst ? clean(input.gstin).toUpperCase() : '';
  const pan = clean(input.pan).toUpperCase();

  return {
    phone,
    street,
    city,
    state,
    pin,
    address,
    gstin,
    pan,
    chargeGst,
  };
}

function hasBillingProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return Boolean(
    profile.phone ||
      profile.address ||
      profile.street ||
      profile.city ||
      profile.state ||
      profile.pin ||
      profile.gstin ||
      profile.pan
  );
}

module.exports = {
  normalizeBillingProfile,
  hasBillingProfile,
  composeAddress,
};
