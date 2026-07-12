import Link from 'next/link'
import { Scale } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1e3a5f] px-6 py-4">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <Scale className="text-orange-400 w-7 h-7" />
          <span className="text-white text-xl font-bold">VakilSaathi</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1e3a5f] mb-2">Terms of Service & Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Effective Date: 7 July 2026 | Governing Law: Uttar Pradesh, India</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <p className="text-orange-800 font-semibold text-sm">⚠️ Zaruri Soochna:</p>
          <p className="text-orange-700 text-sm mt-1">
            VakilSaathi app mein login ya register karne ka matlab hai ki aap in Terms of Service aur Privacy Policy se
            poori tarah sahmat hain. Ye ek legally binding agreement hai. Agar aap sahmat nahi hain toh app ka use band karein.
          </p>
        </div>

        {[
          {
            title: '1. Parichay (Introduction)',
            content: `VakilSaathi ("Platform", "App", "Service") ek practice management aur reminder service hai jo advocates ke
liye muft (gratuitously) provide ki jaati hai. Platform ka malik aur operator ek individual developer hai.
Platform koi law firm nahi hai aur koi legal services provide nahi karta.

App ka use karna is samjhaute (Agreement) ki unconditional acceptance maani jaayegi — chahe aap
is page ko padhe ya na padhe. Ye acceptance app mein login hote hi ho jaati hai aur server logs mein
record hoti hai.`,
          },
          {
            title: '2. Muft Seva (Free Service) — Koi Subscription Nahi',
            content: `VakilSaathi advocates ko bilkul muft di jaati hai. Koi registration fee, subscription fee, ya hidden charge nahi hai.
Platform kabhi bhi, bina kisi notice ke, features add ya remove kar sakta hai.

Kyunki yeh service gratuitously di ja rahi hai, Indian Contract Act 1872 ke Section 25 aur baad ke
sections ke tahat, platform kisi bhi financial loss, missed hearing, ya anyaay ke liye kisi bhi roop mein
zimmedaar nahi hoga.`,
          },
          {
            title: '3. Seema Sunishchit (Limitation of Liability)',
            content: `Platform ki maximum liability, kisi bhi case mein, aur kisi bhi wajah se — ₹0 (SHUNYA) hai.

Platform zimmedaar nahi hoga:
• Kisi bhi missed hearing, peshi, ya court date ke liye
• WhatsApp ya SMS reminder na pahunchne par
• Technical failure, server downtime, ya data loss ke liye
• Client ke na aane ya kisi bhi third party ke actions ke liye
• Kisi bhi indirect, consequential, ya incidental damage ke liye

Ye limitation tab bhi apply hoti hai jab platform ko possible damage ke baare mein bataya gaya ho.`,
          },
          {
            title: '4. Kshatipoorthi (Indemnification)',
            content: `Aap (user) platform, uske developers, aur affiliates ko kisi bhi claim, action, loss, damage, ya expense se
kshatipoorthi karenge jo:
• Aapke app use se arise ho
• Aapke data ya information se arise ho
• Aapke clients ya third parties ke saath aapke behavior se arise ho
• Kisi bhi law ya regulation ke aapke violation se arise ho`,
          },
          {
            title: '5. Vivad Samadhan — Sirf Arbitration (Dispute Resolution)',
            content: `Koi bhi vivad (dispute) SIRF Kanpur, Uttar Pradesh mein registered arbitrator ke paas jaayega.
Court mein case dakhil karna allowed NAHI hai.

Arbitration rules: Arbitration and Conciliation Act, 1996 ke tahat.
Bhasha: Hindi ya English.
Kharcha: Claim karne wala party arbitration ki fees khud bharega.

Class action ya group action POORI TARAH VARJIT hai.
Koi bhi vivad sirf individual basis par hoga.`,
          },
          {
            title: '6. Governing Law & Jurisdiction',
            content: `Ye Agreement Uttar Pradesh, India ke laws ke tahat govern hogi.
Jurisdiction: Kanpur, Uttar Pradesh ke courts.

Note: Arbitration clause ke karan, court mein case dakhil karna tab hi hoga jab arbitration award ka
enforcement ho.`,
          },
          {
            title: '7. Account Terminate Karne Ka Adhikar',
            content: `Platform kisi bhi account ko, kisi bhi samay, bina kisi karan bataye, bina kisi notice ke, turant terminate
kar sakta hai.

Termination ke reasons mein (limited nahi) shamil hain:
• Platform ke terms ka ullanghan
• Abusive, threatening, ya inappropriate behavior
• Platform ke against legal action ki dhamki
• Platform ko nuksaan pahunchane ki koshish`,
          },
          {
            title: '8. Data Aur Privacy',
            content: `Hum sirf wahi data lete hain jo app chalane ke liye zaruri hai:

Aapka Data: Naam, phone, email, BCI number, court preference — app function ke liye.
Case Data: Case number, court naam, judge naam, hearing dates — public record hain (eCourts par bhi available).
Client Data: Naam aur phone number — reminder bhejne ke liye.

Hum NAHI lete: Aadhaar number, bank details, health information, biometric data.

Data Use: Aapka individual data kisi ko sell nahi kiya jaata.
Aggregated/anonymized data (jaise: "Kanpur mein X hearings scheduled") commercial purposes ke liye use ho sakta hai — jisme election campaign broadcasts shamil hain jahan individual identity reveal nahi hoti.

DPDPA 2023 compliance ke tahat, aap apna data delete karne ka request kar sakte hain:
vakil.saathi.app@gmail.com par email karein.`,
          },
          {
            title: '9. Client Data Aur Consent',
            content: `Jab aap kisi client ka number app mein daalte hain:
• Aap guarantee karte hain ki aapne client se WhatsApp/SMS reminder ki permission li hai
• Client ko ek consent message bheja jaata hai ("STOP" se unsubscribe kar sakte hain)
• Client ki "STOP" request hone par turant reminder band karna aapki jimmedaari hai

Platform client data ke misuse ke liye jimmedaar nahi hai.`,
          },
          {
            title: '10. BCI Compliance',
            content: `VakilSaathi ek practice management tool hai — yeh BCI Rule 36 ka ullanghan nahi karta kyunki:
• Yeh clients ko advocates se connect nahi karta
• Yeh advocate ki advertising nahi karta
• Yeh sirf advocate ke existing clients ko reminder bhejta hai

Advocates ki zimmedaari hai ki woh BCI rules ka palan karein. Platform BCI compliance ke liye zimmedaar nahi hai.`,
          },
          {
            title: '11. Sampoorna Samjhauta (Entire Agreement)',
            content: `Ye Terms of Service platform aur aapke beech ka sampoorna samjhauta hai.
Koi bhi maukhik (verbal) baat, promise, ya samjhauta is written agreement ko override nahi karta.
Koi bhi platform representative ka verbal statement legally binding nahi hai.

Platform in terms ko kabhi bhi update kar sakta hai. Continued use = acceptance of updated terms.`,
          },
          {
            title: '12. Sampark (Contact)',
            content: `Data deletion ya privacy concerns ke liye:
Email: vakil.saathi.app@gmail.com

Response time: 30 business days tak.`,
          },
        ].map(({ title, content }) => (
          <section key={title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-3">{title}</h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{content}</p>
          </section>
        ))}

        <div className="bg-[#1e3a5f] rounded-xl p-6 text-center">
          <p className="text-white font-semibold mb-1">App use karke aap in Terms se sahmat hain</p>
          <p className="text-blue-200 text-sm">VakilSaathi — Advocates ke liye, advocate ne banaya</p>
          <Link href="/" className="inline-block mt-4 bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition text-sm font-medium">
            Home Par Jaayein
          </Link>
        </div>
      </main>
    </div>
  )
}
