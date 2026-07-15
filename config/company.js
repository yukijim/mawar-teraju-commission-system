(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.companyConfig = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  return {
    companyName: processEnv('COMPANY_NAME', 'Mawar Teraju'),
    companyLogo: processEnv('COMPANY_LOGO', 'assets/images/branding/logo.png'),
    companyColor: processEnv('COMPANY_COLOR', '0.5 0 0'), // Maroon as default RGB decimal
    supportEmail: processEnv('SUPPORT_EMAIL', 'support@reekod.com'),
    supportPhone: processEnv('SUPPORT_PHONE', '+60123456789'),
    portalName: processEnv('APP_NAME', 'REEKOD Semak'),
    appUrl: processEnv('APP_URL', 'https://semak.reekod.com')
  };

  function processEnv(key, defaultValue) {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    return defaultValue;
  }
}));
