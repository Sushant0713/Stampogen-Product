function toFeatureView(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: String(plain._id),
    _id: String(plain._id),
    name: plain.name,
    code: plain.code,
    category: plain.category,
    description: plain.description || '—',
    timesUsed: Number(plain.timesUsed) || 0,
    status: plain.status,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function normalizeFeaturePayload(body = {}) {
  return {
    name: String(body.name || '').trim(),
    code: String(body.code || '')
      .trim()
      .toLowerCase(),
    category: body.category || 'Core',
    description: String(body.description || '').trim(),
    timesUsed: Number(body.timesUsed) || 0,
    status: body.status === 'Disabled' ? 'Disabled' : 'Enabled',
  };
}

module.exports = {
  toFeatureView,
  normalizeFeaturePayload,
};
