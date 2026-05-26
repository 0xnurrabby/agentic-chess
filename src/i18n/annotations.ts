import type { AnnotationData, AnnotationKind } from "@/types";

export type Lang = "en" | "bn" | "hi" | "zh" | "ru";

export const DEFAULT_LANG: Lang = "en";

export const LANGUAGES: Array<{ code: Lang; label: string; short: string }> = [
  { code: "en", label: "English", short: "EN" },
  { code: "bn", label: "বাংলা", short: "BN" },
  { code: "hi", label: "हिन्दी", short: "HI" },
  { code: "zh", label: "中文", short: "ZH" },
  { code: "ru", label: "Русский", short: "RU" },
];

interface LangPack {
  pieceMovement: Record<string, string>;
  pieceName: Record<string, string>;
  what: Record<AnnotationKind, string>;
  check: string;   // appended to capture-kind sentences when check
  opening: string; // template with {name}
}

const EN: LangPack = {
  pieceMovement: {
    p: "Pawn — moves one square forward (two from its starting rank), captures diagonally. The only piece that can't move backward.",
    n: "Knight — jumps in an L-shape: two squares one way, then one perpendicular. The only piece that can leap over others.",
    b: "Bishop — slides diagonally any number of squares. Each bishop stays on its starting color forever.",
    r: "Rook — slides any number of squares horizontally or vertically. Strongest on open files.",
    q: "Queen — combines rook + bishop. Slides any direction, any distance. The most powerful piece on the board.",
    k: "King — moves one square in any direction. Slow, but if it's checkmated the game is over.",
  },
  pieceName: { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" },
  what: {
    checkmate:
      "Checkmate. The enemy king is attacked and has no legal way to escape, block, or capture the attacker — game over.",
    castleK:
      "Castles kingside. A one-time special move where the king slides two squares toward the rook and the rook hops over to its other side — getting the king to safety behind its pawns while activating the rook.",
    castleQ:
      "Castles queenside. Same special move as kingside castling but on the queen's side — the rook travels farther, so the king ends up a bit more exposed.",
    promotion:
      "Pawn reaches the last rank and instantly promotes to a {promoted}. Promotion is free — the pawn simply becomes a stronger piece, almost always a queen.",
    enpassant:
      "En passant — a special pawn capture, available only on the turn right after an enemy pawn jumped two squares past you. The capturing pawn moves diagonally as if the enemy pawn had moved one square.",
    capGain:
      "Captures the enemy {captured}. The {captured} is worth more than the {piece} taking it — material gain.{check}",
    capSac:
      "Captures the enemy {captured} with the {piece}. A sacrifice — giving up a more valuable piece for an attack or a long-term positional idea.{check}",
    capEven:
      "Captures the enemy {captured}. A roughly even trade — both pieces are similar value.{check}",
    check:
      "Check — the {piece} attacks the enemy king. The opponent MUST respond next move: move the king, block the attack, or capture the attacker.",
    center:
      "Plants the {piece} on a central square ({to}). The four central squares are the most valuable real estate — pieces here control the most board.",
    develop:
      "Develops the {piece} from its starting square to {to}. The opening rule is: bring out knights and bishops before launching attacks or moving the queen.",
    claimCenter:
      "Claims central territory with a pawn push to {to}. Central pawns restrict the enemy's pieces and support your own.",
    earlyQueen:
      "Brings the queen out early to {to}. Risky — minor pieces can chase the queen around with tempo, losing time the opponent uses to develop.",
    kingEndgame:
      "King walks to {to}. In the endgame the king becomes an active piece — with few attackers left, it joins the fight.",
    nearCenter:
      "Steps to {to}, near the center. Pieces here support central control without sitting on the front line.",
    quiet:
      "Quiet move to {to}. Repositions for a future plan rather than starting a tactical fight right now.",
  },
  check: " Plus check — the king is also attacked.",
  opening: " Opening: {name}.",
};

const BN: LangPack = {
  pieceMovement: {
    p: "পন — সামনে এক ঘর এগোয় (শুরুর সারি থেকে দুই ঘর), কোনাকুনি কাটে। একমাত্র গুটি যে পেছনে যেতে পারে না।",
    n: "নাইট — L আকারে লাফ দেয়: এক দিকে দুই ঘর, তারপর লম্বভাবে এক ঘর। একমাত্র গুটি যে অন্য গুটি ডিঙিয়ে যেতে পারে।",
    b: "বিশপ — কোনাকুনি যত খুশি ঘর সরে। প্রতিটি বিশপ চিরকাল তার শুরুর রঙের ঘরেই থাকে।",
    r: "রুক — অনুভূমিক বা উল্লম্বভাবে যত খুশি ঘর সরে। খোলা ফাইলে সবচেয়ে শক্তিশালী।",
    q: "কুইন — রুক + বিশপের মিশ্রণ। যেকোনো দিকে যত খুশি ঘর সরে। বোর্ডের সবচেয়ে শক্তিশালী গুটি।",
    k: "কিং — যেকোনো দিকে এক ঘর সরে। ধীর, কিন্তু চেকমেট হলে খেলা শেষ।",
  },
  pieceName: { p: "পন", n: "নাইট", b: "বিশপ", r: "রুক", q: "কুইন", k: "কিং" },
  what: {
    checkmate:
      "চেকমেট। শত্রু রাজা আক্রান্ত — পালানোর, আটকানোর বা আক্রমণকারীকে কাটার কোনো বৈধ উপায় নেই, খেলা শেষ।",
    castleK:
      "কিংসাইড ক্যাসলিং। একবারের বিশেষ চাল যেখানে রাজা রুকের দিকে দুই ঘর সরে এবং রুক রাজার অপর পাশে চলে যায় — পনের পেছনে রাজা নিরাপদ আর রুক সক্রিয় হয়।",
    castleQ:
      "কুইনসাইড ক্যাসলিং। কিংসাইড ক্যাসলিংয়ের মতোই বিশেষ চাল কিন্তু কুইনের দিকে — রুককে বেশি দূরে যেতে হয়, তাই রাজা একটু বেশি অরক্ষিত থাকে।",
    promotion:
      "পন শেষ সারিতে পৌঁছে সাথে সাথে {promoted}-এ পরিণত হয়। প্রমোশন বিনামূল্যে — পন কেবল আরও শক্তিশালী গুটিতে পরিণত হয়, প্রায়ই কুইন।",
    enpassant:
      "অঁ পাসঁ — বিশেষ পন কাট, শুধু শত্রু পন দুই ঘর লাফ দিয়ে আপনার পাশ কাটিয়ে যাওয়ার ঠিক পরের চালেই সম্ভব। কাটার পন কোনাকুনি যায় যেন শত্রু পন এক ঘরই সরেছিল।",
    capGain:
      "শত্রু {captured} কাটে। {captured} যে {piece} কাটছে তার চেয়ে বেশি মূল্যবান — মেটেরিয়াল লাভ।{check}",
    capSac:
      "{piece} দিয়ে শত্রু {captured} কাটে। স্যাক্রিফাইস — আক্রমণ বা দীর্ঘমেয়াদী পরিকল্পনার জন্য বেশি মূল্যবান গুটি ছেড়ে দেওয়া।{check}",
    capEven:
      "শত্রু {captured} কাটে। মোটামুটি সমান বিনিময় — দুই গুটির মূল্য কাছাকাছি।{check}",
    check:
      "চেক — {piece} শত্রু রাজাকে আক্রমণ করে। প্রতিপক্ষকে পরের চালে অবশ্যই সাড়া দিতে হবে: রাজা সরাও, আক্রমণ আটকাও, বা আক্রমণকারীকে কাটো।",
    center:
      "{piece}-কে কেন্দ্রের ঘরে ({to}) বসায়। চারটি কেন্দ্রীয় ঘর সবচেয়ে মূল্যবান জায়গা — এখানের গুটি বোর্ডের সবচেয়ে বেশি অংশ নিয়ন্ত্রণ করে।",
    develop:
      "{piece}-কে শুরুর ঘর থেকে {to}-এ এনে উন্নয়ন করে। ওপেনিংয়ের নিয়ম: আক্রমণ শুরু করা বা কুইন নাড়ানোর আগে নাইট-বিশপ বের করো।",
    claimCenter:
      "{to}-এ পন এগিয়ে কেন্দ্রীয় অঞ্চল দখল করে। কেন্দ্রীয় পন শত্রুর গুটি সীমাবদ্ধ করে এবং নিজের গুটিকে সমর্থন দেয়।",
    earlyQueen:
      "কুইনকে তাড়াতাড়ি {to}-এ বের করে আনে। ঝুঁকিপূর্ণ — ছোট গুটি কুইনকে তাড়িয়ে বেড়াতে পারে, এই সময়ে প্রতিপক্ষ উন্নয়ন করে নেয়।",
    kingEndgame:
      "রাজা {to}-এ যায়। এন্ডগেমে রাজা সক্রিয় গুটি হয়ে ওঠে — কম আক্রমণকারী থাকায় সে নিজেই লড়াইয়ে যোগ দেয়।",
    nearCenter:
      "{to}-এ যায়, কেন্দ্রের কাছাকাছি। এখানের গুটি সামনের সারিতে না বসেই কেন্দ্রীয় নিয়ন্ত্রণে সাহায্য করে।",
    quiet:
      "{to}-এ শান্ত চাল। এখনই কৌশলগত লড়াই শুরু না করে ভবিষ্যৎ পরিকল্পনার জন্য পুনর্বিন্যাস।",
  },
  check: " এছাড়াও চেক — রাজাও আক্রান্ত।",
  opening: " ওপেনিং: {name}।",
};

const HI: LangPack = {
  pieceMovement: {
    p: "प्यादा — आगे एक खाना (शुरुआती कतार से दो खाने), तिरछा काटता है। एकमात्र मोहरा जो पीछे नहीं जा सकता।",
    n: "घोड़ा — L आकार में कूदता है: एक तरफ़ दो खाने, फिर लंबवत एक खाना। एकमात्र मोहरा जो दूसरों के ऊपर से कूद सकता है।",
    b: "ऊँट — तिरछा कितने भी खाने सरकता है। हर ऊँट हमेशा अपने शुरुआती रंग के खाने पर ही रहता है।",
    r: "हाथी — क्षैतिज या ऊर्ध्वाधर कितने भी खाने सरकता है। खुली फ़ाइलों पर सबसे शक्तिशाली।",
    q: "वज़ीर — हाथी + ऊँट का मेल। किसी भी दिशा में कितने भी खाने सरकता है। बोर्ड का सबसे शक्तिशाली मोहरा।",
    k: "राजा — किसी भी दिशा में एक खाना सरकता है। धीमा, लेकिन चेकमेट होने पर खेल ख़त्म।",
  },
  pieceName: { p: "प्यादा", n: "घोड़ा", b: "ऊँट", r: "हाथी", q: "वज़ीर", k: "राजा" },
  what: {
    checkmate:
      "चेकमेट। दुश्मन का राजा हमले में है और भागने, रोकने या हमलावर को काटने का कोई वैध रास्ता नहीं — खेल ख़त्म।",
    castleK:
      "किंगसाइड कास्टलिंग। एक बार की विशेष चाल जिसमें राजा हाथी की ओर दो खाने सरकता है और हाथी राजा के दूसरी ओर कूदता है — प्यादों के पीछे राजा सुरक्षित और हाथी सक्रिय।",
    castleQ:
      "क्वीनसाइड कास्टलिंग। किंगसाइड कास्टलिंग जैसी ही चाल लेकिन वज़ीर वाली तरफ़ — हाथी ज़्यादा दूर जाता है, इसलिए राजा थोड़ा ज़्यादा खुला रहता है।",
    promotion:
      "प्यादा आख़िरी कतार पर पहुँचकर तुरंत {promoted} में बदल जाता है। प्रमोशन मुफ़्त है — प्यादा बस एक मज़बूत मोहरे में बदल जाता है, लगभग हमेशा वज़ीर।",
    enpassant:
      "ऑन पासां — विशेष प्यादा कट, सिर्फ़ उस चाल में संभव जब दुश्मन का प्यादा दो खाने कूदकर आपके पास से गुज़रा हो। काटने वाला प्यादा तिरछा जाता है मानो दुश्मन का प्यादा एक खाना ही सरका हो।",
    capGain:
      "दुश्मन का {captured} काटता है। काटने वाले {piece} से {captured} ज़्यादा क़ीमती है — मटीरियल फ़ायदा।{check}",
    capSac:
      "{piece} से दुश्मन का {captured} काटता है। बलिदान — आक्रमण या लंबी योजना के लिए ज़्यादा क़ीमती मोहरा देना।{check}",
    capEven:
      "दुश्मन का {captured} काटता है। लगभग बराबर अदला-बदली — दोनों मोहरों की क़ीमत समान है।{check}",
    check:
      "चेक — {piece} दुश्मन के राजा पर हमला करता है। प्रतिद्वंद्वी को अगली चाल में जवाब देना ज़रूरी: राजा हिलाओ, हमला रोको, या हमलावर को काटो।",
    center:
      "{piece} को केंद्रीय खाने ({to}) पर रखता है। चार केंद्रीय खाने सबसे क़ीमती ज़मीन हैं — यहाँ के मोहरे बोर्ड के सबसे ज़्यादा हिस्से को नियंत्रित करते हैं।",
    develop:
      "{piece} को शुरुआती खाने से {to} पर विकसित करता है। ओपनिंग का नियम: आक्रमण या वज़ीर हिलाने से पहले घोड़े-ऊँट निकालो।",
    claimCenter:
      "{to} तक प्यादा बढ़ाकर केंद्रीय इलाक़े पर क़ब्ज़ा। केंद्रीय प्यादे दुश्मन के मोहरों को बाँधते हैं और अपने मोहरों को सहारा देते हैं।",
    earlyQueen:
      "वज़ीर को जल्दी {to} पर निकालता है। जोखिम भरा — छोटे मोहरे वज़ीर का पीछा कर सकते हैं, इस बीच प्रतिद्वंद्वी विकास कर लेता है।",
    kingEndgame:
      "राजा {to} पर चलता है। एंडगेम में राजा सक्रिय मोहरा बन जाता है — कम हमलावर बचे होने पर वह लड़ाई में शामिल हो जाता है।",
    nearCenter:
      "{to} पर जाता है, केंद्र के पास। यहाँ के मोहरे अग्रिम मोर्चे पर बैठे बिना केंद्रीय नियंत्रण को सहारा देते हैं।",
    quiet:
      "{to} तक शांत चाल। अभी रणनीतिक लड़ाई शुरू करने के बजाय भविष्य की योजना के लिए पुनर्व्यवस्था।",
  },
  check: " साथ में चेक — राजा भी हमले में।",
  opening: " ओपनिंग: {name}।",
};

const ZH: LangPack = {
  pieceMovement: {
    p: "兵 — 向前走一格（从起始排可走两格），斜着吃子。唯一不能后退的棋子。",
    n: "马 — 走 L 形：一边两格，再垂直一格。唯一可以跳过其他棋子的棋子。",
    b: "象 — 沿对角线滑动任意格数。每个象永远停留在起始颜色的格子上。",
    r: "车 — 横向或纵向滑动任意格数。在通线上最强。",
    q: "后 — 车与象的结合。任意方向、任意距离滑动。棋盘上最强的棋子。",
    k: "王 — 向任意方向走一格。慢，但被将杀就输了。",
  },
  pieceName: { p: "兵", n: "马", b: "象", r: "车", q: "后", k: "王" },
  what: {
    checkmate:
      "将杀。敌方王受攻击且无法逃跑、阻挡或吃掉攻击者 — 游戏结束。",
    castleK:
      "王翼易位。一次性特殊走法：王向车方向移动两格，车跳到王的另一侧 — 王在兵后获得安全，同时车被激活。",
    castleQ:
      "后翼易位。与王翼易位类似，但在后这一侧 — 车走得更远，所以王相对暴露一些。",
    promotion:
      "兵到达最后一排，立即升变为{promoted}。升变是免费的 — 兵直接变成更强的子，几乎总是后。",
    enpassant:
      "吃过路兵 — 特殊兵吃法，仅在敌方兵刚刚两格跨过你之后的一回合可用。吃过路兵的兵斜着移动，好像敌方兵只走了一格。",
    capGain:
      "吃掉敌方{captured}。{captured}比吃它的{piece}更值钱 — 物质获利。{check}",
    capSac:
      "用{piece}吃掉敌方{captured}。弃子 — 为攻击或长期布局而舍弃更有价值的子。{check}",
    capEven:
      "吃掉敌方{captured}。大致等价交换 — 双方棋子价值相近。{check}",
    check:
      "将军 — {piece}攻击敌方王。对手下一步必须应对：动王、垫子或吃掉攻击者。",
    center:
      "把{piece}放到中心格（{to}）。四个中心格是最有价值的地段 — 这里的子控制最多的棋盘。",
    develop:
      "把{piece}从起始格出动到{to}。开局法则：先出马象，再开始攻击或动后。",
    claimCenter:
      "用兵推进到{to}争夺中心。中心兵限制敌方棋子，并支持己方棋子。",
    earlyQueen:
      "过早把后调到{to}。冒险 — 小子可以驱赶后并获得先手，对手趁机出动子力。",
    kingEndgame:
      "王走到{to}。残局阶段王成为活跃的子 — 攻击者所剩无几，王也加入战斗。",
    nearCenter:
      "走到{to}，靠近中心。这里的子在不暴露前线的情况下支持中心控制。",
    quiet:
      "走到{to}的安静一步。不立即开战，而是为未来计划重新部署。",
  },
  check: " 同时将军 — 王也在攻击之下。",
  opening: " 开局：{name}。",
};

const RU: LangPack = {
  pieceMovement: {
    p: "Пешка — ходит на одну клетку вперёд (с начальной горизонтали на две), бьёт по диагонали. Единственная фигура, которая не может ходить назад.",
    n: "Конь — прыгает буквой Г: две клетки в одну сторону, затем одна перпендикулярно. Единственная фигура, способная перепрыгивать другие.",
    b: "Слон — скользит по диагонали на любое число клеток. Каждый слон навсегда остаётся на полях своего начального цвета.",
    r: "Ладья — скользит по горизонтали или вертикали на любое число клеток. Сильнее всего на открытых линиях.",
    q: "Ферзь — сочетает ладью и слона. Скользит в любом направлении на любое расстояние. Самая сильная фигура на доске.",
    k: "Король — ходит на одну клетку в любую сторону. Медленный, но если получит мат — партия окончена.",
  },
  pieceName: { p: "пешка", n: "конь", b: "слон", r: "ладья", q: "ферзь", k: "король" },
  what: {
    checkmate:
      "Мат. Король противника атакован и не может ни уйти, ни закрыться, ни побить атакующую фигуру — партия окончена.",
    castleK:
      "Короткая рокировка. Одноразовый особый ход: король сдвигается на две клетки к ладье, а ладья перескакивает на другую сторону — король прячется за пешками, а ладья включается в игру.",
    castleQ:
      "Длинная рокировка. То же, что и короткая, но в сторону ферзя — ладья проходит дальше, поэтому король оказывается чуть более уязвимым.",
    promotion:
      "Пешка доходит до последней горизонтали и тут же превращается в {promoted}. Превращение бесплатно — пешка просто становится более сильной фигурой, почти всегда ферзём.",
    enpassant:
      "Взятие на проходе — особое пешечное взятие, доступное только ходом сразу после того, как вражеская пешка прыгнула на две клетки мимо вас. Бьющая пешка идёт по диагонали, как если бы вражеская сходила только на одну клетку.",
    capGain:
      "Берёт {captured} противника. {captured} стоит больше, чем берущая {piece} — выигрыш материала.{check}",
    capSac:
      "Берёт {captured} противника, отдавая {piece}. Жертва — более ценная фигура отдаётся ради атаки или долгосрочной позиционной идеи.{check}",
    capEven:
      "Берёт {captured} противника. Примерно равный размен — фигуры близки по стоимости.{check}",
    check:
      "Шах — {piece} атакует короля противника. Соперник ОБЯЗАН ответить следующим ходом: уйти королём, закрыться или побить атакующего.",
    center:
      "Ставит {piece} на центральное поле ({to}). Четыре центральных поля — самые ценные: фигуры здесь контролируют большую часть доски.",
    develop:
      "Развивает {piece} с начального поля на {to}. Правило дебюта: выводи коней и слонов раньше, чем начинаешь атаку или ходишь ферзём.",
    claimCenter:
      "Захватывает центр пешкой на {to}. Центральные пешки стесняют фигуры противника и поддерживают свои.",
    earlyQueen:
      "Слишком рано выводит ферзя на {to}. Рискованно — лёгкие фигуры гоняют ферзя с темпом, а соперник тем временем развивается.",
    kingEndgame:
      "Король идёт на {to}. В эндшпиле король становится активной фигурой — атакующих почти нет, и он сам вступает в борьбу.",
    nearCenter:
      "Переходит на {to}, ближе к центру. Фигуры здесь поддерживают центральный контроль, не оставаясь на передней линии.",
    quiet:
      "Тихий ход на {to}. Перегруппировка под будущий план, без немедленной тактической стычки.",
  },
  check: " Плюс шах — король тоже под атакой.",
  opening: " Дебют: {name}.",
};

const PACKS: Record<Lang, LangPack> = { en: EN, bn: BN, hi: HI, zh: ZH, ru: RU };

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function pieceName(letter: string | undefined, pack: LangPack): string {
  if (!letter) return "";
  return pack.pieceName[letter] ?? pack.pieceName.p;
}

export function renderAnnotation(data: AnnotationData, lang: Lang): string {
  const pack = PACKS[lang] ?? EN;
  const movement = pack.pieceMovement[data.piece] ?? "";
  const piece = pieceName(data.piece, pack);
  const captured = pieceName(data.captured, pack);
  const promoted = pieceName(data.promotion, pack);
  const checkAddon = data.check ? pack.check : "";
  const template = pack.what[data.kind] ?? "";
  const what = fill(template, {
    to: data.to ?? "",
    piece,
    captured,
    promoted,
    check: checkAddon,
  });
  const opening = data.opening ? fill(pack.opening, { name: data.opening }) : "";
  const joiner = movement ? " " : "";
  return `${movement}${joiner}${what}${opening}`.trim();
}

export function isLang(value: unknown): value is Lang {
  return (
    value === "en" || value === "bn" || value === "hi" || value === "zh" || value === "ru"
  );
}
