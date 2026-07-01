# GROWVA — Website

موقع GROWVA الأول (Homepage) بالكامل: هيرو ثلاثي الأبعاد بـ Three.js، انيميشن عند السكرول بـ GSAP/ScrollTrigger، وتصميم فاخر أسود/عاجي/أخضر زي المطلوب بالضبط.

## الملفات
- `index.html` — الصفحة نفسها وكل الأقسام (Hero, Why Shopify, Services, Process, Work, About, Testimonials, FAQ, Contact, Footer)
- `style.css` — كل التصميم
- `script.js` — الانيميشن والـ 3D والتفاعلات

## إزاي ترفعه على GitHub Pages

1. اعمل repo جديد على GitHub (مثلاً `growva-website`)
2. ارفع الملفات التلاتة (`index.html`, `style.css`, `script.js`) في الـ root بتاع الـ repo
3. روح `Settings > Pages`
4. تحت **Source** اختار `Deploy from a branch` وبعدين اختار `main` والفولدر `/root`
5. احفظ، وهيديك رابط زي: `https://username.github.io/growva-website/`

مفيش build step ولا npm install مطلوب — الموقع static بالكامل وشغال فورًا بمجرد الرفع.

## حاجات لازم تستبدلها بمحتوى حقيقي قبل ما تنشره رسميًا

- **الإيميل والواتساب** في قسم Contact و Footer (حاليًا `hello@growva.com` placeholder)
- **أرقام الـ Stats** (120+ مشروع، 98% رضا... إلخ) — حاليًا أرقام توضيحية لحد ما يكون عندك أرقام حقيقية
- **الـ Case Studies** (Noor Perfumery, Vella Cosmetics, Atelier Marbre) — أسماء وأرقام توضيحية لحد ما تحط شغل حقيقي بالصور الفعلية
- **الـ Testimonials** — نفس الكلام، آراء توضيحية
- **الصور**: دلوقتي الـ Portfolio بيستخدم gradients بدل صور حقيقية — لما يكون عندك صور فوتوغرافيا احترافية للمشاريع، حطها مكان الـ `.case-visual-inner` في CSS كـ `background-image`

## لو عايز تكمل الصفحات التانية (Shopify, Branding, Portfolio كامل, Case Studies منفصلة, Pricing...)

الصفحة دي هي الـ Home بس، ومبنية بنفس نظام التصميم (design tokens) اللي في أول `style.css`. أي صفحة جديدة تقدر تستخدم نفس الـ nav/footer ونفس متغيرات الألوان والخطوط عشان يفضل شكل الموقع موحّد.
