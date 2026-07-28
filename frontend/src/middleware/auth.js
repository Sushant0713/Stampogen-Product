export function isAuthenticatedRequest(request) {
  return Boolean(
    request.cookies.get('accessToken')?.value || request.cookies.get('refreshToken')?.value
  );
}

export function getRoleFromPath(pathname) {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (['super-admin', 'admin', 'affiliate'].includes(segment)) {
    return segment;
  }
  return null;
}
