// read when app.module is imported — must be set before any test file loads it
process.env.RATE_LIMIT_PER_MINUTE = '10000';
process.env.RATE_LIMIT_MULTIPLIER = process.env.RATE_LIMIT_MULTIPLIER ?? '1000';
process.env.NODE_ENV = 'test';
