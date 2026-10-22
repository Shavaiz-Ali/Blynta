/* Read-only Paddle diagnostics. Never prints keys, client tokens, emails, or raw SDK errors. */
const path = require('node:path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});
const { Paddle, Environment } = require('@paddle/paddle-node-sdk');
async function main() {
  const environment = process.env.PADDLE_ENV || 'sandbox';
  if (!['sandbox', 'production'].includes(environment))
    throw new Error('Invalid PADDLE_ENV');
  const paddle = new Paddle(process.env.PADDLE_API_KEY || '', {
    environment:
      environment === 'sandbox' ? Environment.sandbox : Environment.production,
  });
  for (const plan of ['PRO', 'BUSINESS']) {
    const priceId =
      process.env[`PADDLE_PRICE_ID_${plan}`] ||
      process.env[`PADDLE_PRICE_ID_${plan}_MONTHLY`];
    if (!priceId) {
      console.log(JSON.stringify({ plan, environment, configured: false }));
      continue;
    }
    try {
      const price = await paddle.prices.get(priceId);
      const product = await paddle.products.get(price.productId);
      console.log(
        JSON.stringify({
          plan,
          environment,
          configured: true,
          priceStatus: price.status,
          productStatus: product.status,
          billingCycle: price.billingCycle,
          unitPrice: price.unitPrice,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          plan,
          environment,
          configured: true,
          error:
            error?.code || error?.error?.code || 'PADDLE_API_REQUEST_FAILED',
        }),
      );
      process.exitCode = 1;
    }
  }
}
main().catch(() => {
  console.error('Paddle audit could not start. Check server configuration.');
  process.exitCode = 1;
});
