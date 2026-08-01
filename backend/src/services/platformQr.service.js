const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const PlatformQrRepository = require('@repositories/platformQr.repository');

function normalizeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    throw new AppError('URL is required', HTTP_STATUS.BAD_REQUEST);
  }
  let parsed;
  try {
    parsed = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    throw new AppError('Enter a valid website URL', HTTP_STATUS.BAD_REQUEST);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError('URL must start with http:// or https://', HTTP_STATUS.BAD_REQUEST);
  }
  return parsed.toString();
}

class PlatformQrService {
  async create(body = {}, userId = null) {
    const title = String(body.title || '').trim();
    if (title.length < 2) {
      throw new AppError('Title is required', HTTP_STATUS.BAD_REQUEST);
    }

    return PlatformQrRepository.create({
      title,
      url: normalizeUrl(body.url),
      note: String(body.note || '').trim().slice(0, 500),
      createdBy: userId || null,
    });
  }

  async list(query = {}) {
    return PlatformQrRepository.findAll(query);
  }

  async getById(id) {
    const item = await PlatformQrRepository.findById(id);
    if (!item) throw new AppError('QR entry not found', HTTP_STATUS.NOT_FOUND);
    return item;
  }

  async update(id, body = {}) {
    const patch = {};
    if (body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (title.length < 2) {
        throw new AppError('Title is required', HTTP_STATUS.BAD_REQUEST);
      }
      patch.title = title;
    }
    if (body.url !== undefined) {
      patch.url = normalizeUrl(body.url);
    }
    if (body.note !== undefined) {
      patch.note = String(body.note || '').trim().slice(0, 500);
    }

    const item = await PlatformQrRepository.updateById(id, patch);
    if (!item) throw new AppError('QR entry not found', HTTP_STATUS.NOT_FOUND);
    return item;
  }

  async remove(id) {
    const deleted = await PlatformQrRepository.deleteById(id);
    if (!deleted) throw new AppError('QR entry not found', HTTP_STATUS.NOT_FOUND);
    return true;
  }
}

module.exports = new PlatformQrService();
