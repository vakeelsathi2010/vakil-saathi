/* eslint-disable @typescript-eslint/no-require-imports */
const { reminderSpecs } = require('./reminderScheduler')

const reminders = reminderSpecs('2026-07-24', 'Bail', 'Rajesh case')
if (reminders.length !== 3 || !reminders[0].message.includes('3 दिन') || reminders[2].type !== 'CRITICAL') process.exit(1)
console.log(JSON.stringify(reminders, null, 2))
