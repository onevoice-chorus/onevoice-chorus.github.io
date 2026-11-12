// ONE VOICE 2027 当選者のチケット購入ページ（照合）
// 照合は、エントリーフォームと同じ Apps Script（回答シート）で行う
var API_URL = 'https://script.google.com/macros/s/AKfycbw3Uyao6sB70pf8ypkqD1sdYe6Qrs32Q7NxH0XAS7DOqwp3f1mP2xVYzGUKs2jywWxP5w/exec';
// このパソコンで確認するとき（demo/server.py）は、ダミーの当選者リストで照合する
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') API_URL = '/demo-api';

// 券の種類ごとの設定（番号と種類の照合は Apps Script 側で行う）
var KINDS = {
  ippan:         { label: '一般',     price: 19800, max: 1, entry: 'ippan.html',         buy: 'ippan-kounyu.html' },
  koukousei:     { label: '高校生',   price: 15800, max: 1, entry: 'koukousei.html',     buy: 'koukousei-kounyu.html' },
  shochugakusei: { label: '小中学生', price: 12800, max: 5, entry: 'shochugakusei.html', buy: 'shochugakusei-kounyu.html' }
};

function $(id) { return document.getElementById(id); }
function storeKey(kind) { return 'ov2027_ok_' + kind; }
// 名前に使えない半角（半角カナ・半角の数字や記号）が入っていたら true
// 半角の英字（ローマ字）は、外国籍の方のために使えるようにしている
function hasHankaku(s) { return /[\x21-\x40\x5B-\x60\x7B-\x7E\uFF61-\uFF9F]/.test(s); }
function trimAll(s) { return s.replace(/[\s　]/g, ''); }
// フリガナ：空白を除いて、全角のカタカナ（ひらがなも可）と「ー」だけなら true
function isKana(s) { return /^[ァ-ヶぁ-ゖー]+$/.test(trimAll(s)); }

// 入力欄1人分を作る
function personHtml(k, i) {
  var title = k.max > 1 ? '<h4>' + (i + 1) + '人目' + (i > 0 ? ' <button type="button" class="del">削除</button>' : '') + '</h4>' : '';
  return '<div class="person">' + title +
    '<label>エントリー番号（7桁）<input type="text" class="no" inputmode="numeric" autocomplete="off" placeholder="例：8024617"></label>' +
    '<div class="nameRow">' +
    '<label>姓<input type="text" class="last" placeholder="例：滋賀"></label>' +
    '<label>名<input type="text" class="first" placeholder="例：花子"></label>' +
    '</div><p class="warn hidden">日本語のお名前は全角で入力してください</p>' +
    '<label>フリガナ<input type="text" class="kana" placeholder="例：シガ ハナコ"></label>' +
    '<p class="warn kanaWarn hidden">全角のカタカナで入力してください</p></div>';
}

// 照合ページ
function initEntry(kind) {
  var k = KINDS[kind];
  var box = $('people');
  function renumber() {
    var ps = box.querySelectorAll('.person');
    ps.forEach(function (p, i) { var h = p.querySelector('h4'); if (h) h.firstChild.nodeValue = (i + 1) + '人目 '; });
    if ($('add')) $('add').classList.toggle('hidden', ps.length >= k.max);
  }
  function addPerson() {
    var n = box.querySelectorAll('.person').length;
    if (n >= k.max) return;
    box.insertAdjacentHTML('beforeend', personHtml(k, n));
    var del = box.lastElementChild.querySelector('.del');
    if (del) del.addEventListener('click', function () { this.closest('.person').remove(); renumber(); });
    renumber();
  }
  // 半角が入っている名前欄の下に赤文字を出し、そのあいだは「次へ」を押せなくする
  function checkZenkaku() {
    var bad = false;
    box.querySelectorAll('.person').forEach(function (p) {
      var ng = hasHankaku(trimAll(p.querySelector('.last').value + p.querySelector('.first').value));
      p.querySelector('.warn').classList.toggle('hidden', !ng);
      var kana = p.querySelector('.kana').value;
      var kanaNg = trimAll(kana) !== '' && !isKana(kana);
      p.querySelector('.kanaWarn').classList.toggle('hidden', !kanaNg);
      if (ng || kanaNg) bad = true;
    });
    $('btn').disabled = bad;
  }
  box.addEventListener('input', checkZenkaku);
  box.addEventListener('click', function () { setTimeout(checkZenkaku, 0); });
  addPerson();
  if ($('add')) $('add').addEventListener('click', addPerson);

  $('form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    $('error').classList.add('hidden');
    var people = [];
    var errs = [];
    box.querySelectorAll('.person').forEach(function (p, i) {
      var who = k.max > 1 ? (i + 1) + '人目：' : '';
      var no = p.querySelector('.no').value.normalize('NFKC').replace(/\D/g, '');
      var last = trimAll(p.querySelector('.last').value);
      var first = trimAll(p.querySelector('.first').value);
      if (no.length !== 7) errs.push(who + 'エントリー番号（7桁）を入力してください。');
      if (!last || !first) errs.push(who + '姓・名を入力してください。');
      else if (hasHankaku(last + first)) errs.push(who + '日本語のお名前は全角で入力してください。');
      var kana = trimAll(p.querySelector('.kana').value);
      if (!kana) errs.push(who + 'フリガナを入力してください。');
      else if (!isKana(kana)) errs.push(who + 'フリガナは全角のカタカナで入力してください。');
      people.push({ no: no, last: last, first: first, kana: kana });
    });
    var nos = people.map(function (x) { return x.no; });
    if (nos.some(function (n, i) { return n && nos.indexOf(n) !== i; })) errs.push('同じエントリー番号が2回入力されています。');
    if (errs.length) return showError(errs.join('\n'));
    $('btn').disabled = true;
    $('btn').textContent = '確認中です...';
    var url = API_URL + '?action=verifyWinner&kind=' + encodeURIComponent(kind) +
      '&people=' + encodeURIComponent(JSON.stringify(people));
    fetch(url).then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.verified === true) {
        try {
          sessionStorage.setItem(storeKey(kind), JSON.stringify(people.map(function (x) {
            return { no: x.no, name: x.last + ' ' + x.first };
          })));
        } catch (e) {}
        location.href = k.buy;
      } else if (res && res.closed) {
        showError('お支払いの受付期間は、2026年11月20日（金）〜11月26日（木）23:59です。');
      } else {
        showError('エントリー番号とお名前が確認できませんでした。エントリーのときと同じ番号・同じ字で入力してください。' +
          (k.max > 1 ? '\n一緒にエントリーしたお子様がいる場合は、全員分を入力してください。' : ''));
      }
    }).catch(function () {
      showError('通信できませんでした。少し時間をおいて、もう一度お試しください。');
    });
  });
  function showError(msg) {
    $('error').textContent = msg;
    $('error').classList.remove('hidden');
    $('btn').disabled = false;
    $('btn').textContent = '次へ';
  }
}

// 購入ページ（照合を通った人だけ表示）
function initBuy(kind) {
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(storeKey(kind)) || 'null'); } catch (e) {}
  if (!saved || !saved.length) { location.replace(KINDS[kind].entry); return; }
  $('who').textContent = saved.map(function (x) { return x.name + ' 様（' + x.no + '）'; }).join('\n');
  // 小中学生：人数分の合計金額を出す
  if ($('total')) {
    var k = KINDS[kind];
    $('total').textContent = '合計金額：' + (k.price * saved.length).toLocaleString('ja-JP') + '円（' +
      k.price.toLocaleString('ja-JP') + '円 × ' + saved.length + '名）';
  }
  $('main').classList.remove('hidden');
}
