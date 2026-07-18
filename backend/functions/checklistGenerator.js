const CHECKLIST_TEMPLATES = {
  Bail: [
    'FIR copy (from police)', 'Bail application', 'Affidavit (sworn statement)', 'Character certificate',
    'Identity proof', 'Employment letter', 'Court fee receipt', 'Bail deed template',
  ],
  Property: [
    'Property deed/title', 'Registration certificate', 'Encumbrance certificate', 'Property tax receipt',
    'Possession evidence', 'Correspondence letters', 'Court fee',
  ],
  Criminal: [
    'FIR copy', 'Charge sheet', 'Witness statements', 'Cross-examination notes', 'Character witnesses list', 'Court fee',
  ],
}

function normaliseCaseType(caseType) {
  const value = String(caseType || '').trim().toLowerCase()
  if (['bail', 'जमानत'].includes(value)) return 'Bail'
  if (['property', 'property dispute', 'प्रॉपर्टी', 'संपत्ति'].includes(value)) return 'Property'
  if (['criminal', 'ipc', 'क्रिमिनल', 'आपराधिक'].includes(value)) return 'Criminal'
  return null
}

function generateChecklist(caseType, options = {}) {
  const normalizedType = normaliseCaseType(caseType)
  const template = normalizedType ? CHECKLIST_TEMPLATES[normalizedType] : []
  const customItems = Array.isArray(options.customItems) ? options.customItems : []
  const items = [...template, ...customItems]
    .map((title, index) => ({ id: `${normalizedType || 'custom'}-${index + 1}`, title: String(title).trim(), collected: false, notes: '', isCustom: index >= template.length }))
    .filter(item => item.title)
  return { success: Boolean(normalizedType), caseType: normalizedType, items, message: normalizedType ? `${normalizedType} checklist generated` : 'No template available for this case type' }
}

module.exports = { CHECKLIST_TEMPLATES, generateChecklist, normaliseCaseType }
