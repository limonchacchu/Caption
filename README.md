# Limon Chacchu Caption Ghor — নতুন সাইট (v1)

প্লেইন HTML + CSS + JS + Supabase + Netlify। কোনো build step নেই।

## GitHub → Netlify ডিপ্লয়
1. নতুন GitHub রিপোজিটরি বানিয়ে এই ফোল্ডারের সব ফাইল রুটে আপলোড করুন।
2. Netlify → Add new site → Import from GitHub → রিপোজিটরি বেছে নিন।
   Build command ফাঁকা রাখুন, Publish directory `/` (বা ফাঁকা)।
3. ডিপ্লয় হলেই সাইট চালু হবে। Supabase ছাড়াও নমুনা কনটেন্ট দিয়ে কাজ করে।

## Supabase চালু করা (লগইন, পছন্দ, রিয়েল কনটেন্ট)
1. supabase.com-এ ফ্রি প্রজেক্ট খুলুন।
2. SQL Editor-এ ক্রমানুসারে চালান: `supabase/001_profiles.sql`, তারপর `supabase/002_content.sql`।
3. Project Settings → API থেকে URL ও **anon/publishable** key নিয়ে `assets/js/config.js`-এ বসান।
   **service_role key কখনো এখানে বসাবেন না।**
4. Authentication → URL Configuration-এ আপনার Netlify URL দিন। Google লগইনের জন্য Providers-এ Google চালু করুন।
5. নিজেকে অ্যাডমিন বানাতে `002_content.sql`-এর শেষের কমেন্টেড SQL চালান।
6. কনটেন্ট যোগ করতে এখন Supabase Table Editor-এ `contents` টেবিলে `status = published` দিয়ে সারি যোগ করুন (Admin Panel পরের ধাপে)।

## সোশ্যাল লিংক
`config.js`-এর `SOCIAL`-এ শুধু আপনার আসল https লিংক দিন। ফাঁকা থাকলে দেখাবে না।

## কী কী আছে (v1)
সার্চ (বাংলা/ইংরেজি/Roman, typo-tolerant, autocomplete, ভয়েস), ফিল্টার ও সর্টিং, ট্রেন্ডিং স্কোর (সাম্প্রতিক কার্যকলাপে বেশি গুরুত্ব), আজকের কোট, র‍্যান্ডম,
কপি/শেয়ার/পছন্দ, ডার্ক মোড, Supabase লগইন (ইমেইল + Google), PWA ও অফলাইন পেজ, RLS-সহ ডেটাবেজ।

## Design Studio (`/design.html`)
১১টি রেডি টেমপ্লেট, একাধিক লেখা (টেনে সরানো/বড়-ছোট/ঘোরানো), ৭টি বাংলা ওপেন-লাইসেন্স ফন্ট, গ্র্যাডিয়েন্ট/একরঙা/নিজের ছবি ব্যাকগ্রাউন্ড, আনডু/রিডু, ১:১, ৪:৫, ৯:১৬, ১৬:৯ ও কাস্টম সাইজ, PNG/JPG (হাই-রেজ), প্রিভিউ, ফাইলের নাম, ওয়াটারমার্ক সুইচ, সেভ (এই ডিভাইসে; লগইন করলে অ্যাকাউন্টে)।
অ্যাকাউন্টে সেভের জন্য `supabase/003_designs.sql` চালান। হোমপেজের কার্ডে 🎨 বাটন ক্যাপশন সরাসরি স্টুডিওতে পাঠায়।

## পরের ধাপ
Admin Panel, Community, Notification, SEO (প্রতি কনটেন্টের আলাদা পেজ), Gamification।

## নোট
- `sw.js` আপডেট করলে `VERSION` বদলান।
- আইকন প্লেসহোল্ডার; আপনার লোগো দিয়ে `assets/icons/` বদলান।
- সাইটের ডোমেইন ঠিক হলে canonical ও Open Graph URL যোগ করতে হবে।
