const http = require('http')

http
  .createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST' || req.url !== '/public/reservations') {
      return send(501, { code: 'NOT_MODELED' })
    }
    const input = req.body
    const key = req.headers['idempotency-key']
    if (
      !key ||
      !input ||
      input.source !== 'website' ||
      !input.customerName ||
      !input.customerPhone ||
      !Array.isArray(input.lines) ||
      !input.lines.length ||
      input.lines.length > 20
    ) {
      return send(400, { code: 'VALIDATION_ERROR' })
    }
    const hash = JSON.stringify(input)
    const saved = await pm.state.get(`storefront-reservations:${key}`)
    if (saved) {
      return saved.hash === hash
        ? send(201, saved.receipt)
        : send(409, { code: 'IDEMPOTENCY_CONFLICT' })
    }
    const variant = input.lines[0].variantId
    if (variant === 'v_unavailable') {
      return send(409, { code: 'INSUFFICIENT_STOCK' })
    }
    if (variant === 'v_throttled') {
      return send(429, { code: 'RATE_LIMITED' })
    }
    if (variant === 'v_invalid_response') {
      return send(201, {})
    }
    const receipt = {
      id: '64f000000000000000000010',
      number: `R-${key.slice(0, 8)}`,
      status: 'new',
      totalAmount: 43.8,
    }
    await pm.state.set(`storefront-reservations:${key}`, { hash, receipt })
    // Model a committed write whose response could not be delivered successfully.
    return variant === 'v_lost_response' ? send(503, { code: 'RESPONSE_LOST' }) : send(201, receipt)
  })
  .listen(process.env.PORT)
