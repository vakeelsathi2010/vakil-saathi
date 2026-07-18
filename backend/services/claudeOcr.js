/* eslint-disable @typescript-eslint/no-require-imports */

const EXTRACTION_PROMPT = `Read this Indian court order or case photo. Return JSON only with: orderDate (YYYY-MM-DD or null), judgeName (string or null), status (string or null), nextDate (YYYY-MM-DD or null), orders (string array), actionItems (array of objects with title and dueDate YYYY-MM-DD or null), confidence (integer 0-100), reviewNotice (string). Do not invent facts or dates. If unclear, return null and say it needs advocate review.`

function parseClaudeJson(text) {
  return JSON.parse(String(text || '').replace(/^```json\s*|\s*```$/g, ''))
}

async function extractCourtOrder({ buffer, mimeType, apiKey, model }) {
  if (!apiKey) throw new Error('Claude OCR is not configured')
  const base64 = Buffer.from(buffer).toString('base64')
  const documentBlock = mimeType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }
  const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: model || 'claude-sonnet-4-20250514', max_tokens: 1200, messages: [{ role: 'user', content: [documentBlock, { type: 'text', text: EXTRACTION_PROMPT }] }] }) })
  if (!response.ok) throw new Error('Claude OCR request failed')
  const result = await response.json()
  return parseClaudeJson(result.content?.find(item => item.text)?.text)
}

module.exports = { extractCourtOrder }
