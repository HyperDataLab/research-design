// Zod probes `new Function` when an object schema is created, and the hosting CSP forbids eval, so every load
// logged a CSP violation. Zod reads this global when it loads. A classic script runs before the bundled app;
// an import inside the app runs too late, after the shared chunk has already created the schemas.
globalThis.__zod_globalConfig = Object.assign({}, globalThis.__zod_globalConfig, { jitless: true });
