/* SALACIA STUDIO — お問い合わせフォーム
 *
 * ENDPOINT を設定すると、その URL に POST 送信します（Formspree / Basin など）。
 * 空のままの場合は、入力内容を本文に差し込んでメールソフトを起動します。
 * （静的サイトのままでも問い合わせを受け取れるようにするためのフォールバックです）
 */
(function () {
  "use strict";

  var ENDPOINT = ""; // 例: "https://formspree.io/f/xxxxxxxx"
  var MAIL_TO = "contact@salaciastudio.com";

  var form = document.getElementById("contact-form");
  if (!form) return;

  var status = document.getElementById("form-status");

  var setStatus = function (message, isError) {
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? "#b3452f" : "var(--sea)";
  };

  var buildBody = function (data) {
    return [
      "【お名前】" + (data.name || ""),
      "【会社名・団体名】" + (data.company || ""),
      "【メールアドレス】" + (data.email || ""),
      "【ご用件】" + (data.subject || ""),
      "",
      "【お問い合わせ内容】",
      data.message || ""
    ].join("\n");
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var fd = new FormData(form);
    var data = {
      name: fd.get("name"),
      company: fd.get("company"),
      email: fd.get("email"),
      subject: fd.get("subject"),
      message: fd.get("message")
    };

    if (!ENDPOINT) {
      var subject = "【お問い合わせ】" + (data.subject || "SALACIA STUDIO") + "／" + (data.name || "");
      window.location.href =
        "mailto:" + MAIL_TO + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(buildBody(data));
      setStatus("メールソフトを起動しました。内容をご確認のうえ送信してください。", false);
      return;
    }

    var submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    setStatus("送信しています…", false);

    fetch(ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fd
    })
      .then(function (res) {
        if (!res.ok) throw new Error("送信に失敗しました");
        form.reset();
        setStatus("送信しました。3営業日以内にご返信いたします。", false);
      })
      .catch(function () {
        setStatus("送信できませんでした。お手数ですが " + MAIL_TO + " まで直接ご連絡ください。", true);
      })
      .then(function () {
        if (submit) submit.disabled = false;
      });
  });
})();
