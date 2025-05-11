export interface BarrierData {
  en: string;
  ar: string;
}

export interface CityData {
  ar: string;
  barriers: BarrierData[];
}

export interface PalestinianCities {
  [city: string]: CityData;
}

export const PALESTINIAN_CITIES: PalestinianCities = {
  'Nablus': {
    ar: 'نابلس',
    barriers: [
      { en: 'Sarra', ar: 'صرة' },
      { en: 'Checkpoint 17', ar: 'حاجز ال17'},
      { en: 'Aserah Al-Masaken', ar: ' عصيرة المساكن'},
      { en: 'Al-Murabba\'a', ar: 'المربعة' },
      { en: 'Awarta', ar: 'عورتا' },
      { en: 'Yitzhar-Jit', ar: 'يتسهار-جيت' },
      { en: 'Al-Taneeb', ar: 'الطنيب' },
      { en: 'Deir Sharaf', ar: 'دير شرف' },
      { en: 'Shavei Shomron', ar: 'شافي شومرون' },
      { en: 'Bezzaria', ar: 'بزاريا' },
      { en: 'Beit Furik', ar: 'بيت فوريك' },
      { en: 'Hajez Huwwara', ar: 'حاجز حوارة' },
      { en: 'Al-Badan', ar: 'الباذان' },
      { en: 'Jamma\'in', ar: 'جماعين' },
      { en: 'Jeser-Huwwara', ar: 'جسر-حوارة' },
      { en: 'Huwwara-Aljaded', ar: 'حوارة-الجديد' },
      { en: 'Zaatara', ar: 'زعترة' },
      { en: 'Aqraba', ar: 'عقربا' },
      { en: 'Yitzhar', ar: 'يتسهار' },
      { en: 'Huwwara Albalad', ar: 'حوارة البلد' },
      { en: 'Audala', ar: 'اودلا' },
      { en: 'Beita', ar: 'بيتا' },
      { en: 'Jureish', ar: 'جوريش' },
      { en: 'Al-sawieh', ar: 'الساوية' },
      { en: 'Al-Tur', ar: 'الطور' },
      { en: 'Al-Lubban Al-Sharqiya', ar: 'اللبن الشرقية' },
      { en: 'Burin', ar: 'بورين' },
      { en: 'Majdal Bani Fadil', ar: 'مجدل بني فاضل' },
      { en: 'Einabus', ar: 'عينابوس' },
      { en: 'Burqa', ar: 'برقة' },
      { en: 'Qabalan', ar: 'قبلان' },
      { en: 'Duma', ar: 'دومة' },
      { en: 'Qusra', ar: 'قصرة' },
    ]
  },
  'Jerusalem': {
    ar: 'القدس',
    barriers: [
      { en: 'Qalandiya', ar: 'قلنديا' },
      { en: 'Container', ar: 'الكونتينر' },
      { en: 'Hizma', ar: 'حزما' },
      { en: 'Ras Khamis', ar: 'رأس خميس' },
      { en: 'Ras Shehada', ar: 'رأس شحادة' },
      { en: 'Al-Ram', ar: 'الرام' },
      { en: 'Beit Hanina', ar: 'بيت حنينا' },
      { en: 'Shuafat', ar: 'شعفاط' },
      { en: 'Jabal Al-Mukaber', ar: 'جبل المكبر' },
      { en: 'Silwan', ar: 'سلوان' },
      { en: 'Al-Tur', ar: 'الطور' },
      { en: 'Al-Issawiya', ar: 'العيساوية' },
      { en: 'Wadi Al-Joz', ar: 'وادي الجوز' },
    ]
  },
  'Ramallah': {
    ar: 'رام الله',
    barriers: [
      { en: 'DCO', ar: 'دي سي او' },
      { en: 'Beit El', ar: 'بيت ايل' },
      { en: 'Jalazone', ar: 'الجلزون' },
      { en: 'Ein Sina', ar: 'عين سينا' },
      { en: 'Mekhmas', ar: 'مخماس' },
      { en: 'Eion Al haramieh ', ar: ' عيون الحرامية' },
      { en: 'Atara', ar: 'عطارة' },
      { en: 'Rawabie', ar: 'روابي' },
      { en: 'Dir Ballout', ar: 'دير بلوط' },
      { en: 'Turmus\'ayya', ar: 'ترمس عيا' },
      { en: 'Eely', ar: 'عيلي' },
      { en: 'Sinjil', ar: 'سنجل' },
      { en: 'Aufara', ar: 'عوفرا' },
      { en: 'Karmelo', ar: 'كرملو' },
      { en: 'Aabood', ar: 'عابود' },
      { en: 'Ein Yabrud', ar: 'عين عبرود' },
      { en: 'Deir Abu Mash\'al', ar: 'دير ابو مشعل' },
      { en: 'Al nabi saleh', ar: 'النبي صالح' },
      { en: 'Silwad', ar: 'سلواد' },
      { en: 'Qalandiya', ar: 'قلنديا' },
      { en: 'Surda', ar: 'سردا' },
      { en: 'Ein Yabrud', ar: 'عين عبرود' },
      { en: 'Ein Arik', ar: 'عين عريك' },
      { en: 'Beit Sira', ar: 'بيت سيرا' },
      { en: 'Deir Qaddis', ar: 'دير قديس' },
      { en: 'Kafr Ni\'ma', ar: 'كفر نعمة' },
    ]
  },
  'Bethlehem': {
    ar: 'بيت لحم',
    barriers: [
      { en: 'Rachel\'s Tomb', ar: 'قبة الرشيد' },
      { en: 'Gilo', ar: 'جيلو' },
      { en: 'Tunnel', ar: 'القنطرة' },
      { en: 'Al-Khader', ar: 'الخضر' },
      { en: 'Beit Jala', ar: 'بيت جالا' },
      { en: 'Beit Sahour', ar: 'بيت ساحور' },
      { en: 'Al-Ma\'sara', ar: 'المسارة' },
      { en: 'Artas', ar: 'عرضة' },
      { en: 'Battir', ar: 'بتير' },
      { en: 'Husan', ar: 'هوسان' },
      { en: 'Nahhalin', ar: 'نحالين' },
    ]
  },
  'Hebron': {
    ar: 'الخليل',
    barriers: [
      { en: 'Shuhada Street', ar: 'شوهدة الشارع' },
      { en: 'Al-Haram Al-Ibrahimi', ar: 'الحرم الإبراهيمي' },
      { en: 'Tel Rumeida', ar: 'تل رميدة' },
      { en: 'Al-Salaymeh', ar: 'السليمة' },
      { en: 'Al-Shuhada', ar: 'الشهدة' },
      { en: 'Al-Haram', ar: 'الحرم' },
      { en: 'Al-Sahla', ar: 'السهلة' },
      { en: 'Al-Sala\'a', ar: 'السلعة' },
      { en: 'Al-Qasaba', ar: 'القصبة' },
      { en: 'Al-Sheikh', ar: 'الشيخ' },
      { en: 'Al-Baladiya', ar: 'البلدية' },
      { en: 'Al-Haras', ar: 'الحرس' },
    ]
  },
  'Jenin': {
    ar: 'جنين',
    barriers: [
      { en: 'Al-Jalama', ar: 'الجلمة' },
      { en: 'Homesh', ar: 'حومش' },
      { en: 'Bezzaria', ar: 'بزاريا' },
      { en: 'Al-Selih', ar: 'السيلة' },
      { en: 'Dotan', ar: 'دوتان' },
      { en: 'Harmeesh', ar: 'حرميش' },
      { en: 'Al-Zababda', ar: 'الزبابدة' },
      { en: 'Attara', ar: 'عطارة' },
      { en: 'Al-Fandaqumiya', ar: 'الفندقية' },
      { en: 'Al-Mughayyir', ar: 'المغير' },
      { en: 'Arraba', ar: 'عرابة' },
    ]
  },
  'Tulkarm': {
    ar: 'طولكرم',
    barriers: [
      { en: 'Ennab', ar: 'عناب' },
      { en: 'Jbarin', ar: 'جبارة' },
      { en: 'Bet Lid', ar: 'بيت ليد' },
      { en: 'Wad Qana', ar: 'وادي قانا' },
      { en: 'Saffaren', ar: 'سفارين' },
      { en: 'Rameen', ar: 'رامين' },
      { en: 'Azba-shofa', ar: 'عزبة شوفة' },
      { en: 'Sahel Rameen', ar: 'سهل رامين' },
    ]
  },
  'Qalqilya': {
    ar: 'قلقيلية',
    barriers: [
      { en: 'Hajjah', ar: 'حجة' },
      { en: 'Al-Funduq', ar: 'الفندق' },
      { en: 'Qalqilya Entrance', ar: 'مدخل قلقيلية' },
      { en: 'Izbet Al-Tabib (Main Entrance)', ar: 'عزبة الطبيب (المدخل الرئيسي)' },
      { en: 'D.C.O', ar: 'دي سي او' },
      { en: 'Al-Funduq (Main Entrance)', ar: 'الفندق (المدخل الرئيسي)' },
      { en: 'Al-Funduq (Alternative Entrance)', ar: 'الفندق (المدخل البديل)' },
      { en: 'Sofin', ar: 'سوفين' },
      { en: 'Jaljulia / Haberut 109', ar: 'جلجولية / حابروت 109' },
      { en: 'Kafr Qasim / Kafr Ein', ar: 'كفر قاسم / كفر عين' },
      { en: 'Azzun (North Entrance)', ar: 'عزون (المدخل الشمالي)' },
      { en: 'Jinsafut (North-West Entrance)', ar: 'جينصافوط (المدخل الشمالي الغربي)' },
      { en: 'Kafr Laqif (South Entrance)', ar: 'كفر لاقف (المدخل الجنوبي)' },
      { en: 'Azzun', ar: 'عزون' },
      { en: 'Kafr Laqif', ar: 'كفر لاقف' },
      { en: 'Jinsafut', ar: 'جينصافوط' },
      { en: 'Wadi Qana', ar: 'وادي قانا' }
    ]
  },
  'Salfit': {
    ar: 'سلفيت',
    barriers: [
      { en: 'Bruqin', ar: 'برقين' },
      { en: 'Northern Salfit', ar: 'سلفيت الشمالي' },
      { en: 'Southern Salfit', ar: 'سلفيت الجنوبي' },
      { en: 'Ara\'el', ar: 'ارائيل' },
      { en: 'Haris', ar: 'حارس' },
      { en: 'Qadommem', ar: 'قدوميم' },
      { en: 'Wad Qana', ar: 'وادي قانا' },
      { en: 'Deir Estia', ar: 'دير استيا' },
      { en: 'Kafr Aldeek', ar: 'كفر الديك' },
      { en: 'Yasuf', ar: 'ياسوف' },
      { en: 'Marda', ar: 'مردا' },
      { en: 'Kifl Haris', ar: 'كفر حارس' },
    ]
  },
  'Jericho': {
    ar: 'أريحا',
    barriers: [
      { en: 'Al-Hamra', ar: 'الحمرا' },
      { en: 'Ma\'ali afraim', ar: 'معالي افرايم' },
      { en: 'Al-90', ar: 'خط 90' },
      { en: 'Al- Moaaraja', ar: 'المعرجات' },
      { en: 'DCO', ar: 'دي سي او' },
      { en: 'Yellow Gate', ar: 'البوابة الصفراء' },
      { en: 'Al-Haiaa ', ar: 'حاجز الهيئة' },
      { en: 'Al-Banan ', ar: 'حاجز البنانا' },
      { en: 'Al-Auja', ar: 'العوجة' },
      { en: 'Esh Al-Gharab', ar: 'عش الغراب' },
    ]
  },
  'Tubas': {
    ar: 'طوباس',
    barriers: [
      { en: 'Al-Hamra', ar: 'الحمرا' },
      { en: 'Al-Taybeh', ar: 'الطيبة' },
      { en: 'Tammun', ar: 'طمون' },
      { en: 'Tayasir', ar: 'تياسير' },
      { en: 'Wadi Al-Far\'a', ar: 'وادي الفرعة' }
    ]
  }
}; 