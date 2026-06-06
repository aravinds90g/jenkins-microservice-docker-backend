// Manual mock for axios. Each method is a jest.fn that can be configured
// per-test via .mockResolvedValue / .mockRejectedValue.
const axios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(() => axios),
  defaults: { headers: { common: {} } },
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
};

module.exports = axios;
module.exports.default = axios;
