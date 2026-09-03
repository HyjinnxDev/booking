/* TechniCourt booking widget loader. Usage:
   <script src="https://bookings.technicourt.com/embed.js"
           data-path="/s/<id>" data-mode="inline|popup"
           data-label="Book now" data-accent="#17181a" async></script>
   Drops an auto-resizing <iframe> where the tag sits (inline), or a button that
   opens the same iframe in a modal (popup). No dependencies. */
(function () {
  var me = document.currentScript;
  if (!me) return;
  var origin = new URL(me.src).origin;
  var path = me.getAttribute('data-path') || '/';
  var mode = me.getAttribute('data-mode') === 'popup' ? 'popup' : 'inline';
  var label = me.getAttribute('data-label') || 'Book now';
  var accent = me.getAttribute('data-accent') || '#17181a';
  var src = origin + path + (path.indexOf('?') < 0 ? '?' : '&') + 'embed=1';

  if (!document.getElementById('tc-embed-style')) {
    var st = document.createElement('style');
    st.id = 'tc-embed-style';
    st.textContent =
      '@keyframes tc-spin{to{transform:rotate(1turn)}}' +
      '.tc-embed{position:relative;min-height:140px}' +
      '.tc-embed>iframe{opacity:0;transition:opacity .25s}' +
      '.tc-embed.tc-ready>iframe{opacity:1}' +
      '.tc-embed>.tc-spin{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center}' +
      '.tc-embed.tc-ready>.tc-spin{display:none}' +
      '.tc-spin i{width:26px;height:26px;border-radius:50%;border:2px solid ' +
      accent +
      ';border-top-color:transparent;animation:tc-spin .7s linear infinite}';
    document.head.appendChild(st);
  }

  function makeWidget() {
    var box = document.createElement('div');
    box.className = 'tc-embed';
    if (mode === 'popup') box.style.height = '100%';

    var spin = document.createElement('div');
    spin.className = 'tc-spin';
    spin.innerHTML = '<i></i>';

    var f = document.createElement('iframe');
    f.src = src;
    f.title = 'Booking';
    f.setAttribute('data-tc-frame', '');
    f.style.cssText = 'width:100%;border:0;display:block;background:transparent';
    f.style.height = mode === 'popup' ? '100%' : '640px'; // pre-resize guess
    f.addEventListener('load', function () {
      box.classList.add('tc-ready');
    });

    box.appendChild(spin);
    box.appendChild(f);
    return box;
  }

  // The framed page posts its height as it renders / as the user navigates.
  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== 'technicourt:height') return;
    var frames = document.querySelectorAll('iframe[data-tc-frame]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) frames[i].style.height = e.data.height + 'px';
    }
  });

  if (mode === 'popup') {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText =
      'font:inherit;font-weight:600;line-height:1;padding:.65rem 1.15rem;border:0;border-radius:.5rem;cursor:pointer;color:#fff;background:' +
      accent;

    var dlg = document.createElement('dialog');
    dlg.style.cssText =
      'width:min(560px,92vw);height:min(88vh,860px);padding:0;border:0;border-radius:.9rem;overflow:hidden;background:#fcfbf9';

    btn.addEventListener('click', function () {
      if (!dlg.querySelector('iframe')) dlg.appendChild(makeWidget());
      dlg.showModal();
    });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close(); // backdrop click (Esc closes natively)
    });

    me.parentNode.insertBefore(btn, me);
    document.body.appendChild(dlg);
  } else {
    me.parentNode.insertBefore(makeWidget(), me);
  }
})();
