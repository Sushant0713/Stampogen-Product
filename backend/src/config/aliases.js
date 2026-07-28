const path = require('path');
const Module = require('module');

const aliases = {
  '@': path.resolve(__dirname, '..'),
  '@config': path.resolve(__dirname, '../config'),
  '@models': path.resolve(__dirname, '../models'),
  '@controllers': path.resolve(__dirname, '../controllers'),
  '@services': path.resolve(__dirname, '../services'),
  '@repositories': path.resolve(__dirname, '../repositories'),
  '@middlewares': path.resolve(__dirname, '../middlewares'),
  '@validators': path.resolve(__dirname, '../validators'),
  '@utils': path.resolve(__dirname, '../utils'),
  '@helpers': path.resolve(__dirname, '../helpers'),
  '@constants': path.resolve(__dirname, '../constants'),
  '@modules': path.resolve(__dirname, '../modules'),
  '@database': path.resolve(__dirname, '../database'),
};

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  for (const [alias, aliasPath] of Object.entries(aliases)) {
    if (request === alias || request.startsWith(`${alias}/`)) {
      const resolved = request.replace(alias, aliasPath);
      return originalResolveFilename.call(this, resolved, parent, isMain, options);
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
