'use client'

import Link from 'next/link'
import { Scale } from 'lucide-react'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/components/LanguageProvider'

export default function TermsPage() {
  const { isHindi, tr } = useLanguage()
  const sections = isHindi ? [
    ['1. परिचय', 'VakilSaathi अधिवक्ताओं के लिए एक निःशुल्क प्रैक्टिस-प्रबंधन और रिमाइंडर सेवा है। यह किसी विधि फर्म का भाग नहीं है और कानूनी सेवा या सलाह प्रदान नहीं करता। ऐप का उपयोग इस समझौते की स्वीकृति माना जाएगा।'],
    ['2. निःशुल्क सेवा — कोई सदस्यता नहीं', 'VakilSaathi अभी बिना पंजीकरण शुल्क, सदस्यता शुल्क या छिपे शुल्क के उपलब्ध है। सुविधाएँ बदली जा सकती हैं। प्रत्येक न्यायालय तारीख और केस विवरण की स्वतंत्र जाँच करना उपयोगकर्ता की जिम्मेदारी है।'],
    ['3. दायित्व की सीमा', 'लागू कानून की सीमा तक, प्लेटफ़ॉर्म छूटी सुनवाई, गलत तारीख, देर से या न पहुँचे संदेश, तकनीकी विफलता, सर्वर बंद रहने, डेटा हानि, मुवक्किल की अनुपस्थिति या अप्रत्यक्ष हानि के लिए जिम्मेदार नहीं है। VakilSaathi केवल संगठन में सहायता करता है; यह आधिकारिक न्यायालय रिकॉर्ड नहीं है।'],
    ['4. उपयोगकर्ता की जिम्मेदारी', 'आप दर्ज की गई जानकारी की शुद्धता, मुवक्किल की जानकारी के वैध उपयोग, आवश्यक सहमति प्राप्त करने और सभी पेशेवर व कानूनी दायित्वों का पालन करने के लिए जिम्मेदार हैं।'],
    ['5. विवाद समाधान', 'किसी विवाद को पहले नीचे दिए संपर्क माध्यम से प्लेटफ़ॉर्म के सामने रखें ताकि अनौपचारिक समाधान का प्रयास किया जा सके। आगे की कार्यवाही भारतीय कानून के अनुसार होगी।'],
    ['6. लागू कानून और क्षेत्राधिकार', 'यह समझौता भारत के लागू कानूनों द्वारा शासित है। लागू कानून के अधीन, कानपुर, उत्तर प्रदेश के सक्षम न्यायालयों को संबंधित विवादों पर अधिकार होगा।'],
    ['7. खाता निलंबन या समाप्ति', 'शर्तों का उल्लंघन, मुवक्किल डेटा का दुरुपयोग, सेवा को नुकसान पहुँचाने का प्रयास या गैरकानूनी/अपमानजनक व्यवहार होने पर खाता निलंबित या समाप्त किया जा सकता है।'],
    ['8. डेटा और गोपनीयता', 'ऐप चलाने के लिए हम नाम, फोन, ईमेल, BCI नंबर, न्यायालय पसंद, केस विवरण, सुनवाई तारीख, टिप्पणियाँ, चुने गए दस्तावेज़ तथा मुवक्किल का नाम, फोन और सहमति स्थिति रखते हैं। खाता बनाने के लिए बैंक विवरण, बायोमेट्रिक या सरकारी पहचान संख्या आवश्यक नहीं है। व्यक्तिगत डेटा बेचा नहीं जाता। पहुँच, सुधार या हटाने के लिए vakil.saathi.app@gmail.com पर संपर्क करें।'],
    ['9. मुवक्किल डेटा और सहमति', 'मुवक्किल का नंबर जोड़ते समय आप पुष्टि करते हैं कि WhatsApp या SMS सुनवाई रिमाइंडर की अनुमति मिली है। संदेश रोकने के अनुरोध का सम्मान करना और जानकारी का उपयोग केवल वैध केस-प्रबंधन के लिए करना आवश्यक है। सही सहमति दर्ज करना अधिवक्ता की जिम्मेदारी है।'],
    ['10. BCI अनुपालन', 'VakilSaathi प्रैक्टिस-प्रबंधन उपकरण है। यह मुवक्किल और अधिवक्ता का मिलान नहीं करता तथा कानूनी सेवाओं के विज्ञापन के लिए नहीं है। BCI नियमों और अन्य पेशेवर दायित्वों का पालन प्रत्येक अधिवक्ता की जिम्मेदारी है।'],
    ['11. संपूर्ण समझौता', 'ये शर्तें सेवा के उपयोग के संबंध में आपके और प्लेटफ़ॉर्म के बीच संपूर्ण समझौता हैं। सेवा या कानूनी आवश्यकताओं में बदलाव होने पर इन्हें अद्यतन किया जा सकता है और प्रभावी तारीख बदली जाएगी।'],
    ['12. संपर्क', 'डेटा हटाने या गोपनीयता संबंधी अनुरोध के लिए ईमेल करें: vakil.saathi.app@gmail.com\n\nलक्षित उत्तर समय: 30 कार्य दिवसों के भीतर।'],
  ] : [
    ['1. Introduction', 'VakilSaathi is a free practice-management and reminder service for advocates. It is not a law firm and does not provide legal services or advice. Using the App constitutes acceptance of this Agreement.'],
    ['2. Free Service — No Subscription', 'VakilSaathi is currently provided without a registration fee, subscription fee, or hidden charge. Features may change. Users remain responsible for independently verifying every court date and case detail.'],
    ['3. Limitation of Liability', 'To the extent permitted by law, the Platform is not responsible for missed hearings, incorrect dates, delayed or undelivered messages, technical failures, downtime, data loss, client attendance, or indirect loss. VakilSaathi is an organisational aid and is not the official court record.'],
    ['4. User Responsibility', 'You are responsible for the accuracy of entered information, lawful use of client information, obtaining all required consent, and complying with professional and legal obligations.'],
    ['5. Dispute Resolution', 'Raise any dispute with the Platform through the contact details below so an informal resolution can first be attempted. Further proceedings will be governed by applicable Indian law.'],
    ['6. Governing Law and Jurisdiction', 'This Agreement is governed by applicable Indian law. Subject to law, competent courts in Kanpur, Uttar Pradesh will have jurisdiction over related disputes.'],
    ['7. Account Suspension or Termination', 'Accounts may be suspended or terminated for violating these Terms, misusing client data, attempting to damage the Service, or engaging in unlawful or abusive conduct.'],
    ['8. Data and Privacy', 'To operate the App we retain name, phone, email, BCI number, court preferences, case details, case dates, notes, selected documents, and client name, phone and consent status. Bank details, biometrics, and government identity numbers are not required for account creation. Individual data is not sold. Request access, correction, or deletion at vakil.saathi.app@gmail.com.'],
    ['9. Client Data and Consent', 'When adding a client number, you confirm authorisation for WhatsApp or SMS hearing reminders. You must respect requests to stop messages and use client information only for legitimate case management. The advocate is responsible for recording valid consent.'],
    ['10. BCI Compliance', 'VakilSaathi is a practice-management tool. It does not match clients with advocates and is not intended to advertise legal services. Each advocate remains responsible for BCI rules and other professional obligations.'],
    ['11. Entire Agreement', 'These Terms are the complete agreement concerning use of the Service. They may be updated when the Service or legal requirements change, and the effective date will be updated.'],
    ['12. Contact', 'For data-deletion requests or privacy concerns, email vakil.saathi.app@gmail.com.\n\nTarget response time: within 30 business days.'],
  ]

  return <div className="min-h-screen bg-gray-50">
    <header className="flex items-center justify-between bg-[#1e3a5f] px-6 py-4">
      <Link href="/" className="flex items-center gap-2"><Scale className="h-7 w-7 text-orange-400" /><span className="text-xl font-bold text-white">VakilSaathi</span></Link>
      <LanguageToggle compact />
    </header>
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div><h1 className="mb-2 text-3xl font-bold text-[#1e3a5f]">{tr('Terms of Service & Privacy Policy', 'सेवा की शर्तें और गोपनीयता नीति')}</h1><p className="text-sm text-gray-500">{tr('Effective Date: 7 July 2026 | Governing Law: Uttar Pradesh, India', 'प्रभावी तारीख: 7 जुलाई 2026 | लागू कानून: उत्तर प्रदेश, भारत')}</p></div>
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-5"><p className="text-sm font-semibold text-orange-800">⚠️ {tr('Important Notice', 'महत्वपूर्ण सूचना')}:</p><p className="mt-1 text-sm text-orange-700">{tr('By registering or logging in, you agree to these Terms and the Privacy Policy. If you disagree, stop using the App.', 'पंजीकरण या लॉग इन करके आप इन शर्तों और गोपनीयता नीति से सहमत होते हैं। असहमत होने पर ऐप का उपयोग बंद करें।')}</p></div>
      {sections.map(([title, content]) => <section key={title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="mb-3 text-lg font-bold text-[#1e3a5f]">{title}</h2><p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{content}</p></section>)}
      <div className="rounded-xl bg-[#1e3a5f] p-6 text-center"><p className="mb-1 font-semibold text-white">{tr('By using the App, you agree to these Terms', 'ऐप का उपयोग करके आप इन शर्तों से सहमत होते हैं')}</p><p className="text-sm text-blue-200">{tr('VakilSaathi — Built for advocates', 'VakilSaathi — अधिवक्ताओं के लिए निर्मित')}</p><Link href="/" className="mt-4 inline-block rounded-lg bg-orange-500 px-6 py-2 text-sm font-medium text-white hover:bg-orange-600">{tr('Return Home', 'मुख्य पृष्ठ पर लौटें')}</Link></div>
    </main>
  </div>
}
