// Manual mock for express-http-proxy.
// Returns a middleware factory that records the upstream + opts on the
// request and replies 200, so tests can assert routing wiring.
module.exports = jest.fn((upstream, opts) => {
  return (req, res, next) => {
    const proxiedPath = opts && opts.proxyReqPathResolver
      ? opts.proxyReqPathResolver(req)
      : req.url;
    req.proxiedUpstream = upstream;
    req.proxiedPath = proxiedPath;
    res.status(200).json({ upstream, path: proxiedPath, method: req.method });
  };
});
