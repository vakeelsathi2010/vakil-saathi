const names = [
  'Rajesh Kumar', 'Sunita Verma', 'Mohammad Arif', 'Pooja Singh', 'Amit Tiwari',
  'Neha Sharma', 'Rakesh Yadav', 'Shabnam Khan', 'Vivek Mishra', 'Anjali Gupta',
  'Sanjay Patel', 'Farah Naqvi', 'Deepak Saxena', 'Kavita Tripathi', 'Imran Ansari',
  'Meera Dwivedi', 'Arun Chaurasia', 'Nisha Srivastava', 'Pradeep Maurya', 'Saba Siddiqui',
]

const courts = [
  'District Court, Kanpur Nagar', 'Family Court, Kanpur', 'High Court, Allahabad',
  'Labour Court, Kanpur', 'Consumer Forum, Kanpur',
]

const caseTypes = ['Civil', 'Criminal', 'Family', 'Labour', 'Consumer']
const statuses = ['Active', 'Active', 'Active', 'Stayed', 'Disposed']
const purposes = ['Arguments', 'Evidence', 'Judgment', 'Mediation', 'Bail']

function dateFromToday(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split('T')[0]
}

export const DEMO_CASES = names.map((name, index) => ({
  id: `demo-case-${index + 1}`,
  case_number: `${caseTypes[index % caseTypes.length].slice(0, 2).toUpperCase()}/${String(101 + index).padStart(3, '0')}/2026`,
  case_title: `${name.split(' ')[0]} vs ${['State of UP', 'Ramesh', 'ABC Industries', 'Municipal Corp.', 'Insurance Co.'][index % 5]}`,
  court_name: courts[index % courts.length],
  judge_name: `Hon. Judge ${['A. Shukla', 'R. Verma', 'S. Khan', 'P. Mishra', 'N. Singh'][index % 5]}`,
  case_type: caseTypes[index % caseTypes.length],
  opposite_party: ['State of UP', 'Ramesh Kumar', 'ABC Industries', 'KMC', 'Secure Life'][index % 5],
  status: statuses[index % statuses.length],
  clients: { full_name: name },
}))

export const DEMO_CLIENTS = names.map((name, index) => ({
  id: `demo-client-${index + 1}`,
  full_name: name,
  phone: `${[9, 8, 7, 6][index % 4]}8${String(76543210 + index).padStart(8, '0')}`.slice(0, 10),
  address: `${21 + index}, ${['Swaroop Nagar', 'Kidwai Nagar', 'Kalyanpur', 'Civil Lines', 'Govind Nagar'][index % 5]}, Kanpur`,
  notes: index % 3 === 0 ? 'Documents verified. Follow up before next hearing.' : '',
  consent_given: index % 4 !== 0,
  cases: [{ case_number: DEMO_CASES[index].case_number, court_name: DEMO_CASES[index].court_name }],
}))

export const DEMO_CASE_OPTIONS = DEMO_CASES.map((item, index) => ({
  id: item.id,
  case_number: item.case_number,
  court_name: item.court_name,
  clients: { full_name: names[index], phone: DEMO_CLIENTS[index].phone },
}))

export const DEMO_HEARINGS = DEMO_CASES.map((item, index) => ({
  id: `demo-hearing-${index + 1}`,
  hearing_date: dateFromToday(index - 3),
  hearing_time: `${String(10 + (index % 6)).padStart(2, '0')}:30`,
  hearing_purpose: purposes[index % purposes.length],
  outcome: index < 3 ? 'Next date granted' : undefined,
  next_date: index < 3 ? dateFromToday(index + 20) : undefined,
  reminder_sent_advocate: index < 4 || index % 3 === 0,
  reminder_sent_client: index < 4 || index % 4 === 0,
  cases: {
    id: item.id,
    case_number: item.case_number,
    case_title: item.case_title,
    court_name: item.court_name,
    clients: {
      full_name: names[index],
      phone: DEMO_CLIENTS[index].phone,
      consent_given: DEMO_CLIENTS[index].consent_given,
    },
  },
}))

export const DEMO_REMINDER_LOGS = DEMO_HEARINGS.map((item, index) => ({
  id: `demo-reminder-${index + 1}`,
  hearing_id: item.id,
  recipient_type: index % 2 === 0 ? 'client' : 'advocate',
  phone: DEMO_CLIENTS[index].phone,
  channel: index % 3 === 0 ? 'sms' : 'whatsapp',
  status: index % 7 === 0 ? 'failed' : 'sent',
  error_msg: index % 7 === 0 ? 'Delivery failed' : undefined,
  sent_at: `${dateFromToday(-index)}T08:30:00.000Z`,
  hearings: {
    hearing_date: item.hearing_date,
    cases: { case_number: item.cases.case_number, court_name: item.cases.court_name },
  },
}))
